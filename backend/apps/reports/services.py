"""PDF report generation using reportlab."""
import io
from datetime import date, datetime, timedelta, timezone

# Pakistan Standard Time is a fixed UTC+5 offset (no daylight saving).
PKT = timezone(timedelta(hours=5))


def _to_pkt(dt: datetime) -> datetime:
    """Convert a datetime to Pakistan Standard Time (UTC+5).

    Naive datetimes are assumed to be in UTC.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(PKT)

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Black & white palette ─────────────────────────────────────────────────────
# Report is rendered strictly in black and white (no colour). Light grey is used
# only as an achromatic shade for borders and zebra striping to aid readability.
BLACK = colors.HexColor('#000000')
WHITE = colors.HexColor('#FFFFFF')
LIGHT_GREY = colors.HexColor('#EEEEEE')

BRAND_BLUE = BLACK
BRAND_DARK = BLACK
PAGE_BG = WHITE
SURFACE = WHITE
BORDER = BLACK
TEXT_PRIMARY = BLACK
TEXT_SECONDARY = BLACK
TEXT_MUTED = BLACK
ACTION_COLORS = {
    'CREATED': BLACK,
    'ADDED': BLACK,
    'UPDATED': BLACK,
    'DELETED': BLACK,
    'REVEALED': BLACK,
}
MODULE_COLORS = {
    'EnvVariable': BLACK,
    'LicenseKey': BLACK,
    'AdminCredential': BLACK,
    'AppUser': BLACK,
    'Project': BLACK,
    'Team': BLACK,
}


def _styles():
    base = getSampleStyleSheet()
    return {
        'title': ParagraphStyle(
            'ReportTitle',
            parent=base['Normal'],
            fontSize=28,
            leading=34,
            textColor=TEXT_PRIMARY,
            fontName='Times-Bold',
            alignment=TA_CENTER,
            spaceAfter=6,
        ),
        'subtitle': ParagraphStyle(
            'ReportSubtitle',
            parent=base['Normal'],
            fontSize=12,
            leading=16,
            textColor=BRAND_BLUE,
            fontName='Times-Roman',
            alignment=TA_CENTER,
            spaceAfter=2,
        ),
        'meta': ParagraphStyle(
            'ReportMeta',
            parent=base['Normal'],
            fontSize=9,
            textColor=TEXT_SECONDARY,
            fontName='Times-Roman',
            alignment=TA_CENTER,
        ),
        'section_title': ParagraphStyle(
            'SectionTitle',
            parent=base['Normal'],
            fontSize=14,
            leading=18,
            textColor=TEXT_PRIMARY,
            fontName='Times-Bold',
            spaceBefore=14,
            spaceAfter=6,
        ),
        'project_name': ParagraphStyle(
            'ProjectName',
            parent=base['Normal'],
            fontSize=12,
            textColor=BRAND_BLUE,
            fontName='Times-Bold',
            spaceBefore=10,
            spaceAfter=3,
        ),
        'project_meta': ParagraphStyle(
            'ProjectMeta',
            parent=base['Normal'],
            fontSize=8,
            textColor=TEXT_SECONDARY,
            fontName='Times-Roman',
            spaceAfter=4,
        ),
        'cell': ParagraphStyle(
            'Cell',
            parent=base['Normal'],
            fontSize=7.5,
            textColor=TEXT_PRIMARY,
            fontName='Times-Roman',
            leading=10,
        ),
        'cell_muted': ParagraphStyle(
            'CellMuted',
            parent=base['Normal'],
            fontSize=7.5,
            textColor=TEXT_SECONDARY,
            fontName='Times-Roman',
            leading=10,
        ),
        'header_cell': ParagraphStyle(
            'HeaderCell',
            parent=base['Normal'],
            fontSize=8,
            textColor=BRAND_BLUE,
            fontName='Times-Bold',
            leading=10,
        ),
        'no_activity': ParagraphStyle(
            'NoActivity',
            parent=base['Normal'],
            fontSize=8,
            textColor=TEXT_MUTED,
            fontName='Times-Italic',
            alignment=TA_CENTER,
            spaceBefore=4,
            spaceAfter=4,
        ),
        'footer': ParagraphStyle(
            'Footer',
            parent=base['Normal'],
            fontSize=7,
            textColor=TEXT_MUTED,
            fontName='Times-Roman',
            alignment=TA_CENTER,
        ),
        'summary_label': ParagraphStyle(
            'SummaryLabel',
            parent=base['Normal'],
            fontSize=8,
            textColor=TEXT_SECONDARY,
            fontName='Times-Roman',
            alignment=TA_CENTER,
        ),
        'summary_value': ParagraphStyle(
            'SummaryValue',
            parent=base['Normal'],
            fontSize=18,
            leading=22,
            textColor=TEXT_PRIMARY,
            fontName='Times-Bold',
            alignment=TA_CENTER,
        ),
    }


def _header_footer(canvas, doc, generated_by: str, from_date: date, to_date: date):
    canvas.saveState()
    w, h = A4
    margin = 20 * mm

    # ── Header bar ────────────────────────────────────────────────────────────
    canvas.setFillColor(SURFACE)
    canvas.rect(0, h - 18 * mm, w, 18 * mm, fill=1, stroke=0)

    canvas.setFillColor(BRAND_BLUE)
    canvas.setFont('Times-Bold', 11)
    canvas.drawString(margin, h - 11 * mm, 'XIS.AI')

    canvas.setFillColor(TEXT_SECONDARY)
    canvas.setFont('Times-Roman', 9)
    canvas.drawRightString(
        w - margin,
        h - 11 * mm,
        f'Activity Report  |  {from_date.strftime("%b %d, %Y")} – {to_date.strftime("%b %d, %Y")}',
    )

    # ── Footer bar ────────────────────────────────────────────────────────────
    canvas.setFillColor(SURFACE)
    canvas.rect(0, 0, w, 14 * mm, fill=1, stroke=0)

    canvas.setFillColor(TEXT_MUTED)
    canvas.setFont('Times-Roman', 7)
    canvas.drawString(margin, 5 * mm, f'Generated by {generated_by}')
    canvas.drawCentredString(w / 2, 5 * mm, 'XIS.AI Credentials Management Portal - Confidential')
    canvas.drawRightString(w - margin, 5 * mm, f'Page {doc.page}')

    canvas.restoreState()


def generate_activity_report_pdf(
    activities_by_project: list[dict],
    from_date: date,
    to_date: date,
    generated_by: str,
    total_activities: int,
    unique_users: int,
) -> bytes:
    """
    Build and return the PDF as bytes.

    activities_by_project is a list of dicts:
        {
          'project': Project instance,
          'activities': QuerySet of ActivityLog ordered by timestamp desc,
        }
    """
    buffer = io.BytesIO()
    page_w, page_h = A4
    margin = 20 * mm

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=22 * mm,
        bottomMargin=18 * mm,
        title='XIS.AI Activity Report',
        author='XIS.AI Portal',
    )

    st = _styles()
    story = []

    # ── Cover block ───────────────────────────────────────────────────────────
    story.append(Spacer(1, 18 * mm))
    story.append(Paragraph('XIS.AI', st['title']))
    story.append(Paragraph('Activity Report', st['subtitle']))
    story.append(Spacer(1, 3 * mm))
    story.append(
        Paragraph(
            f'{from_date.strftime("%B %d, %Y")} &nbsp;–&nbsp; {to_date.strftime("%B %d, %Y")}',
            st['meta'],
        )
    )
    story.append(
        Paragraph(
            f'Generated by <b>{generated_by}</b> &nbsp;|&nbsp; '
            f'{datetime.now(PKT).strftime("%B %d, %Y at %H:%M Pakistan Standard Time")}',
            st['meta'],
        )
    )
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width='100%', thickness=1, color=BRAND_BLUE, spaceAfter=6))

    # ── Summary stats ─────────────────────────────────────────────────────────
    summary_data = [
        [
            Paragraph(str(total_activities), st['summary_value']),
            Paragraph(str(len(activities_by_project)), st['summary_value']),
            Paragraph(str(unique_users), st['summary_value']),
        ],
        [
            Paragraph('Total Activities', st['summary_label']),
            Paragraph('Projects', st['summary_label']),
            Paragraph('Active Users', st['summary_label']),
        ],
    ]
    col_w = (page_w - 2 * margin) / 3
    summary_table = Table(summary_data, colWidths=[col_w, col_w, col_w])
    summary_table.setStyle(
        TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), SURFACE),
            ('ROUNDEDCORNERS', [6]),
            ('BOX', (0, 0), (-1, -1), 1, BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ])
    )
    story.append(summary_table)
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=4))

    # ── Per-project sections ──────────────────────────────────────────────────
    story.append(Paragraph('Project Activity Details', st['section_title']))

    if not activities_by_project:
        story.append(
            Paragraph('No activity found for the selected date range.', st['no_activity'])
        )
    else:
        col_widths = _activity_col_widths(page_w, margin)

        for index, entry in enumerate(activities_by_project, start=1):
            project = entry['project']
            logs = entry['activities']

            # Project header — ``project`` may be None if the project was
            # deleted (FK is SET_NULL); fall back to the denormalized name
            # stored on the logs instead of crashing.
            if project is not None:
                project_name = project.name
                status_label = project.get_status_display() if hasattr(project, 'get_status_display') else project.status
                creator_name = _user_display(project.created_by) if project.created_by else '—'
                project_description = project.description
            else:
                project_name = next(
                    (log.project_name for log in logs if getattr(log, 'project_name', '')),
                    '',
                ) or 'Unknown Project'
                status_label = 'Unknown'
                creator_name = '—'
                project_description = ''

            story.append(
                Paragraph(f'{index}. {project_name}', st['project_name'])
            )
            story.append(
                Paragraph(
                    f'Status: <b>{status_label}</b> &nbsp;|&nbsp; '
                    f'Created by: <b>{creator_name}</b>'
                    + (f' &nbsp;|&nbsp; {project_description[:120]}' if project_description else ''),
                    st['project_meta'],
                )
            )

            if not logs:
                story.append(
                    Paragraph('No activity recorded for this project in the selected range.', st['no_activity'])
                )
                story.append(HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=2))
                continue

            # Table header row
            table_data = [[
                Paragraph('Date / Time', st['header_cell']),
                Paragraph('User', st['header_cell']),
                Paragraph('Role', st['header_cell']),
                Paragraph('Action', st['header_cell']),
                Paragraph('Module', st['header_cell']),
                Paragraph('Description', st['header_cell']),
            ]]

            for log in logs:
                ts = _to_pkt(log.timestamp).strftime('%b %d, %Y\n%H:%M PKT')
                user_name = _user_display(log.user) if log.user else 'Deleted User'
                user_role = log.user.get_role_display() if log.user and hasattr(log.user, 'get_role_display') else (log.user.role if log.user else '—')
                action = log.action
                module = log.module_name
                description = log.description[:200] + ('…' if len(log.description) > 200 else '')

                action_color = ACTION_COLORS.get(action, TEXT_SECONDARY)
                module_color = MODULE_COLORS.get(module, TEXT_SECONDARY)

                action_para = Paragraph(
                    f'<font color="#{_hex(action_color)}">{action}</font>',
                    st['cell'],
                )
                module_para = Paragraph(
                    f'<font color="#{_hex(module_color)}">{module}</font>',
                    st['cell'],
                )

                table_data.append([
                    Paragraph(ts, st['cell_muted']),
                    Paragraph(user_name, st['cell']),
                    Paragraph(user_role, st['cell_muted']),
                    action_para,
                    module_para,
                    Paragraph(description, st['cell_muted']),
                ])

            tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
            tbl.setStyle(
                TableStyle([
                    # Header row
                    ('BACKGROUND', (0, 0), (-1, 0), WHITE),
                    ('LINEBELOW', (0, 0), (-1, 0), 1, BLACK),
                    # Data rows alternating (achromatic zebra striping)
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
                    # Grid
                    ('INNERGRID', (0, 0), (-1, -1), 0.3, BORDER),
                    ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
                    # Padding
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ])
            )
            story.append(tbl)
            story.append(Spacer(1, 4 * mm))
            story.append(HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=2))

    doc.build(
        story,
        onFirstPage=lambda c, d: _header_footer(c, d, generated_by, from_date, to_date),
        onLaterPages=lambda c, d: _header_footer(c, d, generated_by, from_date, to_date),
    )
    return buffer.getvalue()


def _activity_col_widths(page_w: float, margin: float) -> list[float]:
    usable = page_w - 2 * margin
    return [
        usable * 0.12,  # Date/Time
        usable * 0.13,  # User
        usable * 0.10,  # Role
        usable * 0.10,  # Action
        usable * 0.13,  # Module
        usable * 0.42,  # Description
    ]


def _user_display(user) -> str:
    if not user:
        return '—'
    name = f'{user.first_name} {user.last_name}'.strip()
    return name if name else user.username or user.email


def _hex(color) -> str:
    """Convert a reportlab Color to a 6-digit hex string (without #)."""
    r = int(color.red * 255)
    g = int(color.green * 255)
    b = int(color.blue * 255)
    return f'{r:02X}{g:02X}{b:02X}'
