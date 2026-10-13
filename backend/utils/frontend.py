import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404

# Absolute path to the Next.js static export directory
FRONTEND_DIR: Path = Path(settings.BASE_DIR).parent / "frontend" / "out"

# Placeholder segment name used in generateStaticParams for dynamic routes.
# Django looks for this shell when the real segment ID has no pre-built HTML.
_DYNAMIC_SHELL = "_"


def _open_html(path: Path) -> FileResponse:
    return FileResponse(open(path, "rb"), content_type="text/html; charset=utf-8")


def serve_frontend(request, path: str = ""):
    """
    Serve the Next.js static export from <repo-root>/frontend/out/.

    Resolution order for a request at /some/path/:
      1. Exact file match          — JS/CSS/images/fonts/…
      2. <path>/index.html         — pre-built static page
      3. Sibling shell             — look for out/.../_ /index.html at each
                                     directory level (dynamic route placeholder)
      4. Parent index.html         — walk up the directory tree
      5. Root index.html fallback  — client-side router handles the rest
    """
    clean = path.strip("/")

    # 1. Exact file (assets: _next/static/…, favicon.ico, etc.)
    if clean:
        candidate = FRONTEND_DIR / clean
        if candidate.is_file():
            content_type, _ = mimetypes.guess_type(str(candidate))
            return FileResponse(
                open(candidate, "rb"),
                content_type=content_type or "application/octet-stream",
            )

    # 2. Directory index  (/dashboard/ → out/dashboard/index.html)
    index = (FRONTEND_DIR / clean / "index.html") if clean else (FRONTEND_DIR / "index.html")
    if index.is_file():
        return _open_html(index)

    # 3 & 4. Walk up the directory tree
    parts = Path(clean).parts if clean else ()
    for depth in range(len(parts) - 1, 0, -1):
        parent = FRONTEND_DIR.joinpath(*parts[:depth])

        # 3. Sibling dynamic-route shell (out/<parent>/_/index.html)
        shell = parent / _DYNAMIC_SHELL / "index.html"
        if shell.is_file():
            return _open_html(shell)

        # 4. Parent's own index.html
        parent_index = parent / "index.html"
        if parent_index.is_file():
            return _open_html(parent_index)

    # 5. Root fallback — Next.js client-side router resolves the URL
    root_index = FRONTEND_DIR / "index.html"
    if root_index.is_file():
        return _open_html(root_index)

    raise Http404(
        "Frontend build not found. Run `npm run build` inside the frontend/ directory."
    )
