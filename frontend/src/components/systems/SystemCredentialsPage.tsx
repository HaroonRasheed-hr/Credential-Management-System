"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Monitor,
  Pencil,
  Plus,
  Server,
  ShieldCheck,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { isAdmin as checkIsAdmin } from "@/lib/auth";

// ── Constants ─────────────────────────────────────────────────────────────────

const POPPINS = "Poppins, sans-serif";
const GRADIENT_BG = "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)";

const TABLE_COLS_ADMIN = [
  "Device Name",
  "System IP",
  "RustDesk IP",
  "RustDesk Password",
  "Sudo Password",
  "Device Password",
  "Actions",
];

const TABLE_COLS_DEVELOPER = [
  "Device Name",
  "System IP",
  "RustDesk IP",
  "RustDesk Password",
  "Sudo Password",
  "Device Password",
];

const EMPTY_FORM: FormData = {
  device_name: "",
  device_ip: "",
  rustdesk_ip: "",
  rustdesk_password: "",
  sudo_password: "",
  device_password: "",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeviceCredential {
  id: string;
  device_name: string;
  device_ip: string;
  rustdesk_ip: string;
  rustdesk_password: string; // masked (••••••••) or empty
  sudo_password: string;
  device_password: string;
  created_at: string;
  updated_at: string;
}

interface RevealedPasswords {
  rustdesk_password: string;
  sudo_password: string;
  device_password: string;
  [key: string]: string;
}

type FormData = Omit<DeviceCredential, "id" | "created_at" | "updated_at">;

// ── Shared input style ────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  padding: "12px 16px",
  color: "#ffffff",
  outline: "none",
  fontFamily: POPPINS,
  fontSize: 14,
};

const inputError: React.CSSProperties = {
  ...inputBase,
  border: "1px solid rgba(239,68,68,0.60)",
};

// ── Responsive helper ─────────────────────────────────────────────────────────
// Starts false so SSR/first paint matches the desktop markup (avoids hydration
// mismatch); the effect corrects it on mount and on viewport changes.

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}

// ── Password input (modal) ────────────────────────────────────────────────────

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputBase, paddingRight: 44 }}
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", lineHeight: 0, padding: 4 }}
        aria-label={show ? "Hide" : "Show"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// ── Password cell (table) ─────────────────────────────────────────────────────

function PasswordCell({
  storedValue,
  revealKey,
  revealedData,
  revealedFields,
  copiedKey,
  revealing,
  onToggleReveal,
  onCopy,
}: {
  storedValue: string;
  revealKey: string;                          // "<uuid>|<fieldName>"
  revealedData: Map<string, RevealedPasswords>; // fetched plaintext per device
  revealedFields: Set<string>;                // which specific fields are visible
  copiedKey: string | null;
  revealing: Set<string>;                     // which revealKeys are loading
  onToggleReveal: (revealKey: string) => void;
  onCopy: (key: string, val: string) => void;
}) {
  const pipeIdx = revealKey.indexOf("|");
  const deviceId = revealKey.substring(0, pipeIdx);
  const fieldName = revealKey.substring(pipeIdx + 1);

  // Each field tracks its own revealed/loading state independently
  const isRevealed = revealedFields.has(revealKey);
  const isRevealing = revealing.has(revealKey);
  const isCopied = copiedKey === revealKey;
  const hasValue = Boolean(storedValue);

  if (!hasValue) {
    return <span style={{ color: "rgba(255,255,255,0.25)", fontFamily: POPPINS, fontSize: 13 }}>—</span>;
  }

  const entry = revealedData.get(deviceId);
  const plaintext = isRevealed && entry ? entry[fieldName] ?? "" : "";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          fontFamily: isRevealed ? "'Courier New', Courier, monospace" : POPPINS,
          fontSize: 13,
          color: isRevealed ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.35)",
          whiteSpace: "nowrap",
        }}
      >
        {isRevealed ? plaintext : "••••••••"}
      </span>

      {/* Eye toggle — toggling one field never affects sibling fields */}
      <button
        type="button"
        onClick={() => onToggleReveal(revealKey)}
        disabled={isRevealing}
        style={{ color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: isRevealing ? "not-allowed" : "pointer", padding: 4, borderRadius: 6, lineHeight: 0 }}
        aria-label={isRevealed ? "Hide" : "Show"}
        onMouseEnter={(e) => { if (!isRevealing) { (e.currentTarget as HTMLButtonElement).style.color = "#03A1FE"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; } }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
      >
        {isRevealing ? <Loader2 size={14} className="animate-spin" /> : isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>

      {/* Copy — only when this specific field is revealed */}
      {isRevealed && (
        <button
          type="button"
          onClick={() => onCopy(revealKey, plaintext)}
          style={{ color: isCopied ? "#4ade80" : "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, lineHeight: 0 }}
          aria-label={isCopied ? "Copied" : "Copy"}
          onMouseEnter={(e) => { if (!isCopied) { (e.currentTarget as HTMLButtonElement).style.color = "#03A1FE"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; } }}
          onMouseLeave={(e) => { if (!isCopied) { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; } }}
        >
          {isCopied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );
}

// ── Device Card (mobile) ──────────────────────────────────────────────────────
// Same data + handlers as a table row, laid out vertically for narrow screens.

function DeviceCard({
  dev,
  isAdmin,
  isDeleting,
  revealedData,
  revealedFields,
  copiedKey,
  revealing,
  onToggleReveal,
  onCopy,
  onEdit,
  onDelete,
}: {
  dev: DeviceCredential;
  isAdmin: boolean;
  isDeleting: boolean;
  revealedData: Map<string, RevealedPasswords>;
  revealedFields: Set<string>;
  copiedKey: string | null;
  revealing: Set<string>;
  onToggleReveal: (revealKey: string) => void;
  onCopy: (key: string, val: string) => void;
  onEdit: (dev: DeviceCredential) => void;
  onDelete: (id: string) => void;
}) {
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "rgba(255,255,255,0.45)",
    fontFamily: POPPINS,
    flexShrink: 0,
  };
  const ipValueStyle: React.CSSProperties = {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: 13,
    color: "rgba(255,255,255,0.70)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "right",
  };
  const dash = <span style={{ color: "rgba(255,255,255,0.25)", fontFamily: POPPINS, fontSize: 13 }}>—</span>;

  const passwordRows: { label: string; field: "rustdesk_password" | "sudo_password" | "device_password"; stored: string }[] = [
    { label: "RustDesk Password", field: "rustdesk_password", stored: dev.rustdesk_password },
    { label: "Sudo Password", field: "sudo_password", stored: dev.sudo_password },
    { label: "Device Password", field: "device_password", stored: dev.device_password },
  ];

  return (
    <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)", padding: 16, opacity: isDeleting ? 0.5 : 1, transition: "opacity 0.2s" }}>

      {/* Card header — device name + actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: GRADIENT_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Monitor size={16} color="#fff" />
          </div>
          <span style={{ fontFamily: POPPINS, fontSize: 15, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {dev.device_name}
          </span>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <button type="button" onClick={() => onEdit(dev)}
              style={{ color: "rgba(255,255,255,0.40)", background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6, lineHeight: 0 }}
              aria-label="Edit device"
            ><Pencil size={16} /></button>
            <button type="button" onClick={() => !isDeleting && onDelete(dev.id)} disabled={isDeleting}
              style={{ color: "rgba(255,255,255,0.40)", background: "none", border: "none", cursor: isDeleting ? "not-allowed" : "pointer", padding: 6, borderRadius: 6, lineHeight: 0 }}
              aria-label="Delete device"
            >{isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</button>
          </div>
        )}
      </div>

      {/* Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={labelStyle}>System IP</span>
          <span style={ipValueStyle}>{dev.device_ip || dash}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={labelStyle}>RustDesk IP</span>
          <span style={ipValueStyle}>{dev.rustdesk_ip || dash}</span>
        </div>
        {passwordRows.map(({ label, field, stored }) => (
          <div key={field} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={labelStyle}>{label}</span>
            <div style={{ display: "flex", justifyContent: "flex-end", minWidth: 0 }}>
              <PasswordCell
                storedValue={stored}
                revealKey={`${dev.id}|${field}`}
                revealedData={revealedData}
                revealedFields={revealedFields}
                copiedKey={copiedKey}
                revealing={revealing}
                onToggleReveal={onToggleReveal}
                onCopy={onCopy}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Device Modal (Add & Edit) ─────────────────────────────────────────────────

function DeviceModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: DeviceCredential;
  onSave: (data: FormData, id?: string) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState<FormData>(
    initial
      ? {
          device_name: initial.device_name,
          device_ip: initial.device_ip,
          rustdesk_ip: initial.rustdesk_ip,
          rustdesk_password: "",   // never pre-fill passwords — user must re-enter to change
          sudo_password: "",
          device_password: "",
        }
      : EMPTY_FORM
  );
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "device_name" && value.trim()) setNameError(false);
  }

  async function handleSubmit() {
    if (!form.device_name.trim()) { setNameError(true); return; }
    setSaving(true);
    setSaveError("");
    try {
      await onSave(
        {
          device_name: form.device_name.trim(),
          device_ip: form.device_ip.trim(),
          rustdesk_ip: form.rustdesk_ip.trim(),
          rustdesk_password: form.rustdesk_password,
          sudo_password: form.sudo_password,
          device_password: form.device_password,
        },
        initial?.id
      );
      onClose();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, saving]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current && !saving) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)", padding: "0 16px" }}
    >
      <div style={{ width: "100%", maxWidth: 520, maxHeight: "calc(100vh - 32px)", overflowY: "auto", borderRadius: 20, border: "1px solid rgba(255,255,255,0.10)", background: "#181818", padding: 24, boxShadow: "0px 8px 40px 0px rgba(0,0,0,0.60)", fontFamily: POPPINS }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: GRADIENT_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isEdit ? <Pencil size={16} color="#fff" /> : <Monitor size={17} color="#fff" />}
            </div>
            <h2 style={{ color: "#fff", fontWeight: 600, fontSize: 18, margin: 0 }}>
              {isEdit ? "Edit Device" : "Add Device"}
            </h2>
          </div>
          <button type="button" onClick={() => !saving && onClose()}
            style={{ background: "none", border: "none", cursor: saving ? "not-allowed" : "pointer", color: "rgba(255,255,255,0.40)", padding: 6, borderRadius: 8, lineHeight: 0 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.40)"; }}
            aria-label="Close"><X size={18} /></button>
        </div>

        {/* Error banner */}
        {saveError && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
            <AlertCircle size={15} color="#f87171" />
            <span style={{ color: "#f87171", fontSize: 13, fontFamily: POPPINS }}>{saveError}</span>
          </div>
        )}

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label htmlFor="f-device_name" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", marginBottom: 6, fontFamily: POPPINS }}>
              <Server size={12} /> Device Name <span style={{ color: "#f87171" }}>*</span>
            </label>
            <input id="f-device_name" type="text" value={form.device_name} onChange={(e) => set("device_name", e.target.value)} placeholder="e.g. Production Server" style={nameError ? inputError : inputBase} />
            {nameError && <p style={{ color: "#f87171", fontSize: 12, marginTop: 4, fontFamily: POPPINS }}>Device name is required.</p>}
          </div>

          <div>
            <label htmlFor="f-device_ip" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", marginBottom: 6, fontFamily: POPPINS }}>
              <Wifi size={12} /> System IP
            </label>
            <input id="f-device_ip" type="text" value={form.device_ip} onChange={(e) => set("device_ip", e.target.value)} placeholder="e.g. 192.168.1.100" style={inputBase} />
          </div>

          <div>
            <label htmlFor="f-rustdesk_ip" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", marginBottom: 6, fontFamily: POPPINS }}>
              <Monitor size={12} /> RustDesk IP
            </label>
            <input id="f-rustdesk_ip" type="text" value={form.rustdesk_ip} onChange={(e) => set("rustdesk_ip", e.target.value)} placeholder="e.g. 123456789" style={inputBase} />
          </div>

          <div>
            <label htmlFor="f-rustdesk_password" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", marginBottom: 6, fontFamily: POPPINS }}>
              <KeyRound size={12} /> RustDesk Password {isEdit && <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>(leave blank to keep current)</span>}
            </label>
            <PasswordInput id="f-rustdesk_password" value={form.rustdesk_password} onChange={(v) => set("rustdesk_password", v)} placeholder="RustDesk password" />
          </div>

          <div>
            <label htmlFor="f-sudo_password" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", marginBottom: 6, fontFamily: POPPINS }}>
              <ShieldCheck size={12} /> Sudo Password {isEdit && <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>(leave blank to keep current)</span>}
            </label>
            <PasswordInput id="f-sudo_password" value={form.sudo_password} onChange={(v) => set("sudo_password", v)} placeholder="sudo / root password" />
          </div>

          <div>
            <label htmlFor="f-device_password" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", marginBottom: 6, fontFamily: POPPINS }}>
              <KeyRound size={12} /> Device Password {isEdit && <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>(leave blank to keep current)</span>}
            </label>
            <PasswordInput id="f-device_password" value={form.device_password} onChange={(v) => set("device_password", v)} placeholder="Device login password" />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
          <button type="button" onClick={() => !saving && onClose()} disabled={saving}
            style={{ borderRadius: 20, padding: "10px 20px", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.50)", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", cursor: saving ? "not-allowed" : "pointer", fontFamily: POPPINS }}
            onMouseEnter={(e) => { if (!saving) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; } }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.50)"; }}
          >Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            style={{ borderRadius: 20, padding: "10px 24px", fontSize: 14, fontWeight: 700, color: "#fff", background: GRADIENT_BG, border: "none", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)", fontFamily: POPPINS, opacity: saving ? 0.7 : 1 }}
            onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.10)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "none"; }}
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving…</>
            ) : isEdit ? (
              <><Pencil size={14} /> Save Changes</>
            ) : (
              <><Plus size={15} /> Add Device</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DeviceCredentialsPage() {
  const { user } = useAuth();
  const isAdmin = checkIsAdmin(user?.role);
  const isMobile = useIsMobile();
  const [devices, setDevices] = useState<DeviceCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceCredential | null>(null);
  // revealedData: fetched plaintext cache per device (one API call per device)
  const [revealedData, setRevealedData] = useState<Map<string, RevealedPasswords>>(new Map());
  // revealedFields: tracks which specific "<deviceId>|<field>" keys are visually shown
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());
  // revealing: which "<deviceId>|<field>" keys are currently loading
  const [revealing, setRevealing] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Fetch devices on mount ─────────────────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.get<{ data: DeviceCredential[] | { results: DeviceCredential[] } }>(
        "/api/v1/devices/"
      );
      const payload = res.data?.data;
      const list = Array.isArray(payload)
        ? payload
        : (payload as { results: DeviceCredential[] })?.results ?? [];
      setDevices(list);
    } catch {
      setLoadError("Failed to load device credentials.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // ── Add / Edit ─────────────────────────────────────────────────────────────
  async function handleSave(data: FormData, id?: string) {
    if (id) {
      // Edit — send only fields that have changed; blank password = keep existing
      const payload: Partial<FormData> = {
        device_name: data.device_name,
        device_ip: data.device_ip,
        rustdesk_ip: data.rustdesk_ip,
      };
      if (data.rustdesk_password) payload.rustdesk_password = data.rustdesk_password;
      if (data.sudo_password) payload.sudo_password = data.sudo_password;
      if (data.device_password) payload.device_password = data.device_password;

      const res = await api.patch<{ data: DeviceCredential }>(`/api/v1/devices/${id}/`, payload);
      const updated = res.data?.data;
      setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
      // clear cached plaintext and any visible fields for this device
      setRevealedData((prev) => { const n = new Map(prev); n.delete(id); return n; });
      setRevealedFields((prev) => {
        const n = new Set(prev);
        [`${id}|rustdesk_password`, `${id}|sudo_password`, `${id}|device_password`].forEach((k) => n.delete(k));
        return n;
      });
    } else {
      const res = await api.post<{ data: DeviceCredential }>("/api/v1/devices/", data);
      const created = res.data?.data;
      setDevices((prev) => [created, ...prev]);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`/api/v1/devices/${id}/`);
      setDevices((prev) => prev.filter((d) => d.id !== id));
      setRevealedData((prev) => { const n = new Map(prev); n.delete(id); return n; });
      setRevealedFields((prev) => {
        const n = new Set(prev);
        [`${id}|rustdesk_password`, `${id}|sudo_password`, `${id}|device_password`].forEach((k) => n.delete(k));
        return n;
      });
      if (copiedKey?.startsWith(id)) setCopiedKey(null);
    } catch {
      // silently ignore — device stays in list
    } finally {
      setDeletingId(null);
    }
  }

  // ── Reveal ─────────────────────────────────────────────────────────────────
  // revealKey = "<deviceId>|<fieldName>"
  // Each field is toggled independently. The API is called at most once per device;
  // subsequent fields reuse the cached plaintext from revealedData.
  async function toggleReveal(revealKey: string) {
    // Hide if already visible
    if (revealedFields.has(revealKey)) {
      setRevealedFields((prev) => { const n = new Set(prev); n.delete(revealKey); return n; });
      return;
    }

    const pipeIdx = revealKey.indexOf("|");
    const deviceId = revealKey.substring(0, pipeIdx);

    // If plaintext is already cached for this device, just show this field
    if (revealedData.has(deviceId)) {
      setRevealedFields((prev) => new Set(prev).add(revealKey));
      return;
    }

    // Fetch from API — mark only this field as loading
    setRevealing((prev) => new Set(prev).add(revealKey));
    try {
      const res = await api.get<{ data: RevealedPasswords }>(`/api/v1/devices/${deviceId}/reveal/`);
      const d = res.data?.data;
      setRevealedData((prev) => new Map(prev).set(deviceId, {
        rustdesk_password: d?.rustdesk_password ?? "",
        sudo_password: d?.sudo_password ?? "",
        device_password: d?.device_password ?? "",
      }));
      setRevealedFields((prev) => new Set(prev).add(revealKey));
    } catch {
      // reveal failed — silently ignore
    } finally {
      setRevealing((prev) => { const n = new Set(prev); n.delete(revealKey); return n; });
    }
  }

  // ── Copy ───────────────────────────────────────────────────────────────────
  async function handleCopy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1500);
    } catch { /* clipboard unavailable */ }
  }

  function openAdd() { setEditingDevice(null); setModalOpen(true); }
  function openEdit(dev: DeviceCredential) { setEditingDevice(dev); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditingDevice(null); }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", padding: isMobile ? "24px 16px" : "40px 64px", fontFamily: POPPINS }}>

      {/* Page heading */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "flex-start", justifyContent: "space-between", gap: 16, marginBottom: isMobile ? 24 : 32 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: GRADIENT_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Monitor size={20} color="#fff" />
            </div>
            <h1 style={{ color: "#fff", fontSize: isMobile ? 20 : 24, fontWeight: 600, margin: 0 }}>Device Credentials</h1>
          </div>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: 0, paddingLeft: 52 }}>
            Store remote device access details. Device name is required.
          </p>
        </div>

        {isAdmin && (
          <button type="button" onClick={openAdd}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 20, background: GRADIENT_BG, border: "none", cursor: "pointer", padding: "12px 28px", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: POPPINS, boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)", flexShrink: 0 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.10)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "none"; }}
          >
            <Plus size={18} strokeWidth={2.5} /> Add Device
          </button>
        )}
      </div>

      {/* Load error */}
      {loadError && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 24 }}>
          <AlertCircle size={16} color="#f87171" />
          <span style={{ color: "#f87171", fontSize: 14, fontFamily: POPPINS }}>{loadError}</span>
        </div>
      )}

      {/* Table / empty state */}
      {loading ? (
        <div style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)", padding: "80px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <Loader2 size={28} color="#03A1FE" className="animate-spin" />
          <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 14, margin: 0 }}>Loading device credentials…</p>
        </div>
      ) : devices.length === 0 ? (
        <div style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)", padding: "80px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(3, 161, 254,0.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Monitor size={26} color="#03A1FE" />
          </div>
          <p style={{ color: "#fff", fontSize: 15, fontWeight: 500, margin: "0 0 4px" }}>No devices added yet</p>
          <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 13, margin: isAdmin ? "0 0 24px" : 0 }}>
            {isAdmin ? "Click “Add Device” to store your first device credentials." : "No device credentials have been added yet."}
          </p>
          {isAdmin && (
            <button type="button" onClick={openAdd}
              style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 20, background: GRADIENT_BG, border: "none", cursor: "pointer", padding: "10px 24px", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: POPPINS, boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.10)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "none"; }}
            ><Plus size={15} /> Add Device</button>
          )}
        </div>
      ) : isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {devices.map((dev) => (
            <DeviceCard
              key={dev.id}
              dev={dev}
              isAdmin={isAdmin}
              isDeleting={deletingId === dev.id}
              revealedData={revealedData}
              revealedFields={revealedFields}
              copiedKey={copiedKey}
              revealing={revealing}
              onToggleReveal={toggleReveal}
              onCopy={handleCopy}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div style={{ width: "100%", overflow: "hidden", borderRadius: 20, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                  {(isAdmin ? TABLE_COLS_ADMIN : TABLE_COLS_DEVELOPER).map((col) => (
                    <th key={col} style={{ padding: "16px 24px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.55)", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap", fontFamily: POPPINS }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.map((dev, index) => {
                  const isEven = index % 2 === 0;
                  const isDeleting = deletingId === dev.id;
                  return (
                    <tr key={dev.id}
                      style={{ background: isEven ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)", opacity: isDeleting ? 0.5 : 1, transition: "opacity 0.2s" }}
                      onMouseEnter={(e) => { if (!isDeleting) (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.07)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isEven ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)"; }}
                    >
                      <td style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontFamily: POPPINS, fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap" }}>
                        {dev.device_name}
                      </td>
                      <td style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontFamily: "'Courier New', Courier, monospace", fontSize: 13, color: "rgba(255,255,255,0.70)", whiteSpace: "nowrap" }}>
                        {dev.device_ip || <span style={{ color: "rgba(255,255,255,0.25)", fontFamily: POPPINS }}>—</span>}
                      </td>
                      <td style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontFamily: "'Courier New', Courier, monospace", fontSize: 13, color: "rgba(255,255,255,0.70)", whiteSpace: "nowrap" }}>
                        {dev.rustdesk_ip || <span style={{ color: "rgba(255,255,255,0.25)", fontFamily: POPPINS }}>—</span>}
                      </td>
                      <td style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <PasswordCell storedValue={dev.rustdesk_password} revealKey={`${dev.id}|rustdesk_password`} revealedData={revealedData} revealedFields={revealedFields} copiedKey={copiedKey} revealing={revealing} onToggleReveal={toggleReveal} onCopy={handleCopy} />
                      </td>
                      <td style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <PasswordCell storedValue={dev.sudo_password} revealKey={`${dev.id}|sudo_password`} revealedData={revealedData} revealedFields={revealedFields} copiedKey={copiedKey} revealing={revealing} onToggleReveal={toggleReveal} onCopy={handleCopy} />
                      </td>
                      <td style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <PasswordCell storedValue={dev.device_password} revealKey={`${dev.id}|device_password`} revealedData={revealedData} revealedFields={revealedFields} copiedKey={copiedKey} revealing={revealing} onToggleReveal={toggleReveal} onCopy={handleCopy} />
                      </td>
                      {isAdmin && (
                        <td style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button type="button" onClick={() => openEdit(dev)}
                              style={{ color: "rgba(255,255,255,0.40)", background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, lineHeight: 0 }}
                              aria-label="Edit device"
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#03A1FE"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.40)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                            ><Pencil size={15} /></button>

                            <button type="button" onClick={() => !isDeleting && handleDelete(dev.id)} disabled={isDeleting}
                              style={{ color: "rgba(255,255,255,0.40)", background: "none", border: "none", cursor: isDeleting ? "not-allowed" : "pointer", padding: 4, borderRadius: 6, lineHeight: 0 }}
                              aria-label="Delete device"
                              onMouseEnter={(e) => { if (!isDeleting) { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)"; } }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.40)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                            >
                              {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <DeviceModal
          initial={editingDevice ?? undefined}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
