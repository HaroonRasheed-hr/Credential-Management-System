"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Code2,
  Rocket,
  Server,
  Monitor,
  Lock,
  Wifi,
  KeyRound,
  Eye,
  EyeOff,
  Pencil,
  Copy,
  ShieldOff,
  Check,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  X,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useEnvironmentCredentials } from "@/hooks/useEnvironmentCredentials";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface Credentials {
  systemName: string;
  systemIp: string;
  adminPassword: string;
  rustdeskIp: string;
  rustdeskPassword: string;
}

type CredentialFieldKey = keyof Credentials;

interface FieldConfig {
  key: CredentialFieldKey;
  label: string;
  icon: LucideIcon;
  alwaysVisible?: boolean;
}

/** A device from GET /api/v1/devices/ */
interface DeviceItem {
  id: string;
  device_name: string;
  device_ip: string;
}

/** An assignment returned by GET/POST /api/v1/devices/projects/<id>/ */
interface AssignedDevice {
  id: string;        // ProjectDevice UUID
  device_id: string; // DeviceCredential UUID
  device_name: string;
  device_ip: string;
  added_at: string;
}

const FIELD_CONFIG: FieldConfig[] = [
  { key: "systemName", label: "System Name", icon: Server, alwaysVisible: true },
  { key: "systemIp", label: "System IP", icon: Monitor },
  { key: "adminPassword", label: "Admin Password", icon: Lock },
  { key: "rustdeskIp", label: "RustDesk IP", icon: Wifi },
  { key: "rustdeskPassword", label: "RustDesk Password", icon: KeyRound },
];

const POPPINS = "Poppins, sans-serif";
const GRADIENT = "linear-gradient(180deg, #03A9F4 0%, #086FB7 100%)";

// ── Single credential field row ──────────────────────────────────────────────

interface CredentialFieldRowProps {
  field: FieldConfig;
  value: string;
  editMode: boolean;
  revealed: boolean;
  onToggleReveal: () => void;
  onChange: (value: string) => void;
  onCopy: () => void;
  copied: boolean;
}

function CredentialFieldRow({
  field,
  value,
  editMode,
  revealed,
  onToggleReveal,
  onChange,
  onCopy,
  copied,
}: CredentialFieldRowProps) {
  const Icon = field.icon;
  const isVisible = field.alwaysVisible || revealed;

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-all duration-200 sm:flex-row sm:items-center sm:justify-between"
      style={{ boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)" }}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} className="flex-shrink-0 text-gray-400" />
        <span
          className="text-xs font-medium uppercase tracking-wider text-gray-400"
          style={{ fontFamily: POPPINS, letterSpacing: "0.08em" }}
        >
          {field.label}
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-2 sm:justify-end">
        {editMode ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#03A9F4]/50 sm:w-56"
            style={{ fontFamily: POPPINS }}
            aria-label={field.label}
            autoComplete="off"
            data-form-type="other"
          />
        ) : (
          <>
            <span
              className="truncate text-sm"
              style={{
                fontFamily: field.alwaysVisible
                  ? POPPINS
                  : isVisible
                    ? "'Courier New', Courier, monospace"
                    : POPPINS,
                fontWeight: field.alwaysVisible ? 700 : 400,
                color: field.alwaysVisible
                  ? "#03A9F4"
                  : isVisible
                    ? "rgba(255,255,255,0.85)"
                    : "rgba(255,255,255,0.40)",
                maxWidth: "180px",
              }}
              title={isVisible ? value : undefined}
            >
              {isVisible ? value : "••••••••"}
            </span>

            {!field.alwaysVisible && (
              <button
                type="button"
                onClick={onToggleReveal}
                className="flex-shrink-0 rounded-md p-1 text-gray-400 transition-all duration-200 hover:bg-white/10 hover:text-[#03A9F4]"
                aria-label={revealed ? "Hide value" : "Reveal value"}
              >
                {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            )}

            {isVisible && !field.alwaysVisible && (
              <button
                type="button"
                onClick={onCopy}
                className="relative flex-shrink-0 rounded-md p-1 transition-all duration-200 hover:bg-white/10"
                style={{ color: copied ? "#4ade80" : "rgba(255,255,255,0.40)" }}
                aria-label={copied ? "Copied" : "Copy value"}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied && (
                  <span
                    className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium text-white"
                    style={{
                      fontFamily: POPPINS,
                      background: "rgba(0,0,0,0.9)",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    Copied!
                  </span>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Add Device Modal ──────────────────────────────────────────────────────────

function AddDeviceModal({
  availableDevices,
  adding,
  onClose,
  onAdd,
}: {
  availableDevices: DeviceItem[];
  adding: boolean;
  onClose: () => void;
  onAdd: (device: DeviceItem) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = availableDevices.filter(
    (d) =>
      d.device_name.toLowerCase().includes(search.toLowerCase()) ||
      d.device_ip.toLowerCase().includes(search.toLowerCase())
  );

  const selected = availableDevices.find((d) => d.id === selectedId) ?? null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !adding) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, adding]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !adding) onClose(); }}
    >
      <div
        className="relative flex w-full max-w-[520px] flex-col rounded-2xl border"
        style={{
          background: "#1a1a1a",
          borderColor: "rgba(255,255,255,0.10)",
          boxShadow: "0px 8px 32px 0px rgba(0,0,0,0.70)",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between border-b px-8 py-6"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div>
            <h3 className="text-xl font-bold text-white" style={{ fontFamily: POPPINS }}>
              Add Device
            </h3>
            <p className="mt-0.5 text-xs" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}>
              Select a device to add to this project.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !adding && onClose()}
            className="flex items-center justify-center rounded-full transition-all duration-200 hover:bg-white/10"
            style={{ width: 32, height: 32, color: "rgba(255,255,255,0.50)", background: "none", border: "none", cursor: adding ? "not-allowed" : "pointer", lineHeight: 0, flexShrink: 0 }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-8 py-4">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.35)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or IP…"
              className="w-full rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", fontFamily: POPPINS }}
            />
          </div>
        </div>

        {/* Device list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {availableDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Monitor size={32} style={{ color: "rgba(255,255,255,0.18)", marginBottom: 10 }} />
              <p className="text-sm" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.35)" }}>
                All devices are already added to this project.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.35)" }}>
              No devices match &ldquo;{search}&rdquo;.
            </p>
          ) : (
            filtered.map((device) => {
              const isSelected = selectedId === device.id;
              return (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => setSelectedId(device.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-150"
                  style={{
                    background: isSelected ? "rgba(3,169,244,0.10)" : "transparent",
                    border: isSelected ? "1px solid rgba(3,169,244,0.30)" : "1px solid transparent",
                    cursor: "pointer",
                    marginBottom: 4,
                  }}
                >
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: "rgba(3,169,244,0.12)" }}
                  >
                    <Monitor size={16} color="#03A9F4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white" style={{ fontFamily: POPPINS }}>
                      {device.device_name}
                    </p>
                    {device.device_ip && (
                      <p className="truncate text-xs" style={{ fontFamily: "'Courier New', Courier, monospace", color: "rgba(255,255,255,0.45)" }}>
                        {device.device_ip}
                      </p>
                    )}
                  </div>
                  {isSelected && <Check size={16} color="#03A9F4" className="flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-8 py-5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => !adding && onClose()}
              disabled={adding}
              className="flex-1 rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ fontFamily: POPPINS, background: "transparent", border: "1px solid rgba(255,255,255,0.20)", cursor: adding ? "not-allowed" : "pointer" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => selected && onAdd(selected)}
              disabled={!selected || adding}
              className="flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-50"
              style={{ fontFamily: POPPINS, background: GRADIENT, border: "none", cursor: !selected || adding ? "not-allowed" : "pointer" }}
            >
              {adding && <Loader2 size={14} className="animate-spin" />}
              {adding ? "Adding…" : "Add to Project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Development device list section ──────────────────────────────────────────

function DeviceListSection({
  projectId,
  allDevices,
  allLoading,
  allError,
  readOnly,
}: {
  projectId: string;
  allDevices: DeviceItem[];
  allLoading: boolean;
  allError: string;
  readOnly: boolean;
}) {
  const [assigned, setAssigned] = useState<AssignedDevice[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(true);
  const [assignedError, setAssignedError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchAssigned = useCallback(async () => {
    if (!projectId) return;
    setAssignedLoading(true);
    setAssignedError("");
    try {
      const res = await api.get<{ data: AssignedDevice[] }>(`/api/v1/devices/projects/${projectId}/`);
      const payload = res.data?.data;
      setAssigned(Array.isArray(payload) ? payload : []);
    } catch {
      setAssignedError("Failed to load project devices.");
    } finally {
      setAssignedLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAssigned();
  }, [fetchAssigned]);

  const assignedDeviceIds = new Set(assigned.map((a) => a.device_id));
  const availableToAdd = allDevices.filter((d) => !assignedDeviceIds.has(d.id));

  async function handleAdd(device: DeviceItem) {
    setAdding(true);
    try {
      const res = await api.post<{ data: AssignedDevice }>(`/api/v1/devices/projects/${projectId}/`, {
        device_id: device.id,
      });
      const created = res.data?.data;
      setAssigned((prev) => [...prev, created]);
      setShowModal(false);
    } catch {
      // modal stays open, user can retry
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(assignment: AssignedDevice) {
    setRemovingId(assignment.id);
    try {
      await api.delete(`/api/v1/devices/projects/${projectId}/${assignment.device_id}/`);
      setAssigned((prev) => prev.filter((a) => a.id !== assignment.id));
    } catch {
      // silently ignore — row stays in list
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
    }
  }

  const loading = allLoading || assignedLoading;
  const error = allError || assignedError;

  return (
    <>
      {showModal && (
        <AddDeviceModal
          availableDevices={availableToAdd}
          adding={adding}
          onClose={() => !adding && setShowModal(false)}
          onAdd={handleAdd}
        />
      )}

      <div
        className="rounded-2xl border border-white/10 p-6"
        style={{ background: "rgba(255,255,255,0.05)", boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)" }}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20">
              <Code2 size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white" style={{ fontFamily: POPPINS }}>
                Development
              </h3>
              <p className="mt-0.5 text-sm text-gray-400" style={{ fontFamily: POPPINS }}>
                System credentials for the development environment
              </p>
              <span
                className="mt-2 inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-400"
                style={{ fontFamily: POPPINS }}
              >
                {loading
                  ? "Loading…"
                  : `${assigned.length} device${assigned.length !== 1 ? "s" : ""}`}
              </span>
            </div>
          </div>

          {!readOnly && !loading && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-white/5"
              style={{ fontFamily: POPPINS }}
            >
              <Plus size={14} />
              Add Device
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} color="#03A9F4" className="animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <AlertCircle size={16} className="text-red-400" />
            <p className="text-sm text-red-300" style={{ fontFamily: POPPINS }}>{error}</p>
          </div>
        ) : assigned.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <ShieldOff size={36} className="text-gray-500" />
            <p className="text-sm text-gray-400" style={{ fontFamily: POPPINS }}>
              No devices added yet.
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="rounded-xl border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-white/5"
                style={{ fontFamily: POPPINS }}
              >
                + Add Device
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {assigned.map((dev) => {
              const isConfirming = confirmRemoveId === dev.id;
              const isRemoving = removingId === dev.id;
              return (
                <div
                  key={dev.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-all duration-200 hover:bg-white/[0.07]"
                  style={{ boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)", opacity: isRemoving ? 0.5 : 1 }}
                >
                  {/* Left: icon + name + IP */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ background: "rgba(3,169,244,0.12)" }}
                    >
                      <Monitor size={14} color="#03A9F4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white" style={{ fontFamily: POPPINS }}>
                        {dev.device_name}
                      </p>
                      {dev.device_ip && (
                        <p className="truncate text-xs" style={{ fontFamily: "'Courier New', Courier, monospace", color: "rgba(255,255,255,0.45)" }}>
                          {dev.device_ip}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: remove with confirm */}
                  {!readOnly && (
                    isConfirming ? (
                      <span className="flex flex-shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRemove(dev)}
                          disabled={isRemoving}
                          className="rounded px-2 py-0.5 text-xs font-semibold text-red-400 transition-all duration-150 hover:bg-red-500/15 disabled:opacity-50"
                          style={{ fontFamily: POPPINS, background: "none", border: "1px solid rgba(239,68,68,0.40)", cursor: isRemoving ? "not-allowed" : "pointer" }}
                        >
                          {isRemoving ? "…" : "Yes"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="rounded px-2 py-0.5 text-xs font-semibold transition-all duration-150 hover:bg-white/10"
                          style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)", background: "none", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(dev.id)}
                        className="flex-shrink-0 transition-all duration-200"
                        style={{ color: "rgba(255,255,255,0.32)", background: "none", border: "none", cursor: "pointer", padding: "4px", lineHeight: 0 }}
                        aria-label={`Remove ${dev.device_name}`}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.32)"; }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ── Deployment section card ──────────────────────────────────────────────────

interface CredentialsSectionProps {
  sectionId: string;
  credentialId: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  badgeClassName: string;
  data: Credentials;
  editMode: boolean;
  tempData: Credentials;
  revealedFields: Set<string>;
  copiedField: string | null;
  readOnly: boolean;
  saving?: boolean;
  onToggleEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onTempChange: (key: CredentialFieldKey, value: string) => void;
  onToggleReveal: (fieldKey: string) => void;
  onCopy: (fieldKey: string, value: string) => void;
}

function CredentialsSection({
  sectionId,
  title,
  subtitle,
  icon: SectionIcon,
  badgeClassName,
  data,
  editMode,
  tempData,
  revealedFields,
  copiedField,
  readOnly,
  saving,
  onToggleEdit,
  onCancel,
  onSave,
  onTempChange,
  onToggleReveal,
  onCopy,
}: CredentialsSectionProps) {
  const hasData = Object.values(data).some((v) => v.trim() !== "");

  return (
    <div
      className="rounded-2xl border border-white/10 p-6"
      style={{ background: "rgba(255,255,255,0.05)", boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)" }}
    >
      {/* Section header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${badgeClassName}`}>
            <SectionIcon size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: POPPINS }}>
              {title}
            </h3>
            <p className="mt-0.5 text-sm text-gray-400" style={{ fontFamily: POPPINS }}>
              {subtitle}
            </p>
            <span
              className="mt-2 inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-400"
              style={{ fontFamily: POPPINS }}
            >
              {FIELD_CONFIG.length} credentials stored
            </span>
          </div>
        </div>

        {!editMode && !readOnly && (
          <button
            type="button"
            onClick={onToggleEdit}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-white/5"
            style={{ fontFamily: POPPINS }}
          >
            <Pencil size={14} />
            Edit
          </button>
        )}
      </div>

      {/* Fields or empty state */}
      {hasData || editMode ? (
        <div className="space-y-4">
          {FIELD_CONFIG.map((field) => {
            const fieldKey = `${sectionId}-${field.key}`;
            return (
              <CredentialFieldRow
                key={fieldKey}
                field={field}
                value={editMode ? tempData[field.key] : data[field.key]}
                editMode={editMode}
                revealed={revealedFields.has(fieldKey)}
                onToggleReveal={() => onToggleReveal(fieldKey)}
                onChange={(v) => onTempChange(field.key, v)}
                onCopy={() => onCopy(fieldKey, data[field.key])}
                copied={copiedField === fieldKey}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <ShieldOff size={36} className="text-gray-500" />
          <p className="text-sm text-gray-400" style={{ fontFamily: POPPINS }}>
            No credentials stored yet.
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={onToggleEdit}
              className="rounded-xl border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-white/5"
              style={{ fontFamily: POPPINS }}
            >
              + Add Credentials
            </button>
          )}
        </div>
      )}

      {/* Edit mode footer */}
      {editMode && (
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-[20px] border border-white/20 bg-transparent px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ fontFamily: POPPINS }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-[20px] px-6 py-3 text-sm font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
            style={{ fontFamily: POPPINS, background: GRADIENT, boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)" }}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CredentialsOverviewTabProps {
  projectId: string;
  readOnly?: boolean;
}

export default function CredentialsOverviewTab({
  projectId,
  readOnly = false,
}: CredentialsOverviewTabProps) {
  const {
    data: credentials,
    loading,
    error,
    updateEnvironmentCredential,
    revealEnvironmentCredential,
  } = useEnvironmentCredentials(projectId);

  // ── All devices (for modal availability list) ───────────────────────────────
  const [allDevices, setAllDevices] = useState<DeviceItem[]>([]);
  const [allDevicesLoading, setAllDevicesLoading] = useState(true);
  const [allDevicesError, setAllDevicesError] = useState("");

  useEffect(() => {
    async function fetchAll() {
      try {
        const res = await api.get<{ data: DeviceItem[] | { results: DeviceItem[] } }>("/api/v1/devices/");
        const payload = res.data?.data;
        const list = Array.isArray(payload)
          ? payload
          : (payload as { results: DeviceItem[] })?.results ?? [];
        setAllDevices(list);
      } catch {
        setAllDevicesError("Failed to load devices.");
      } finally {
        setAllDevicesLoading(false);
      }
    }
    fetchAll();
  }, []);

  // ── Deployment section state ────────────────────────────────────────────────
  const [deployEditMode, setDeployEditMode] = useState(false);
  const [deployTemp, setDeployTemp] = useState<Credentials>({
    systemName: "",
    systemIp: "",
    adminPassword: "",
    rustdeskPassword: "",
    rustdeskIp: "",
  });
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Auto-dismiss the toast ~2s after it appears. Driving it from an effect (vs.
  // a fire-and-forget setTimeout at each call site) lets us clear the pending
  // timer on unmount / when the toast changes, so it can't fire into a gone
  // component.
  useEffect(() => {
    if (toast === null) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  // Reset the "copied" indicator after 1.5s, with the same cleanup guarantee.
  useEffect(() => {
    if (copiedField === null) return;
    const t = setTimeout(() => setCopiedField(null), 1500);
    return () => clearTimeout(t);
  }, [copiedField]);

  const deployCred = credentials.find((c) => c.environment_type === "DEPLOYMENT");

  const deployData: Credentials = {
    systemName: deployCred?.system_name ?? "",
    systemIp: deployCred?.system_ip ?? "",
    adminPassword: deployCred?.admin_password ?? "",
    rustdeskIp: deployCred?.rustdesk_ip ?? "",
    rustdeskPassword: deployCred?.rustdesk_password ?? "",
  };

  const toggleReveal = async (fieldKey: string) => {
    const [, fieldName] = fieldKey.split("-");
    const cred = deployCred;
    if (!cred) return;

    if (revealedFields.has(fieldKey)) {
      setRevealedFields((prev) => { const n = new Set(prev); n.delete(fieldKey); return n; });
      return;
    }

    if (fieldName === "adminPassword" || fieldName === "rustdeskPassword") {
      try {
        await revealEnvironmentCredential(cred.id);
        setRevealedFields((prev) => new Set(prev).add(fieldKey));
      } catch {
        setToast("Failed to reveal password");
      }
    } else {
      setRevealedFields((prev) => new Set(prev).add(fieldKey));
    }
  };

  const handleCopy = async (fieldKey: string, value: string) => {
    try { await navigator.clipboard.writeText(value); } catch { /* unavailable */ }
    setCopiedField(fieldKey);
  };

  const showSavedToast = () => {
    setToast("Saved!");
  };

  const handleDeployEdit = () => { setDeployTemp(deployData); setDeployEditMode(true); };
  const handleDeployCancel = () => { setDeployTemp(deployData); setDeployEditMode(false); };
  const handleDeploySave = async () => {
    if (!deployCred) { setToast("Credential not found"); return; }
    setSaving(true);
    try {
      await updateEnvironmentCredential(deployCred.id, {
        system_name: deployTemp.systemName,
        system_ip: deployTemp.systemIp,
        admin_password: deployTemp.adminPassword,
        rustdesk_ip: deployTemp.rustdeskIp,
        rustdesk_password: deployTemp.rustdeskPassword,
      });
      setDeployEditMode(false);
      showSavedToast();
    } catch {
      setToast("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };
  const handleDeployTempChange = (key: CredentialFieldKey, value: string) => {
    setDeployTemp((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="py-8">
        <div className="mb-8">
          <div className="h-8 w-64 animate-pulse rounded bg-white/5" />
          <div className="mt-2 h-4 w-96 animate-pulse rounded bg-white/5" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-96 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-96 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8">
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-4">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-red-400" />
          <p className="text-sm text-red-300" style={{ fontFamily: POPPINS }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8" style={{ fontFamily: POPPINS }}>
      {/* Page title */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-white" style={{ fontFamily: POPPINS }}>
          Credentials Overview
        </h2>
        <p className="mt-1 text-sm text-gray-400" style={{ fontFamily: POPPINS }}>
          Store and manage system and deployment credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Development — device selection backed by API */}
        <DeviceListSection
          projectId={projectId}
          allDevices={allDevices}
          allLoading={allDevicesLoading}
          allError={allDevicesError}
          readOnly={readOnly}
        />

        {/* Deployment — unchanged */}
        <CredentialsSection
          sectionId="deploy"
          credentialId={deployCred?.id ?? ""}
          title="Deployment"
          subtitle="System credentials for the production/deployment environment"
          icon={Rocket}
          badgeClassName="bg-purple-500/20"
          data={deployData}
          editMode={deployEditMode}
          tempData={deployTemp}
          revealedFields={revealedFields}
          copiedField={copiedField}
          readOnly={readOnly}
          saving={saving}
          onToggleEdit={handleDeployEdit}
          onCancel={handleDeployCancel}
          onSave={handleDeploySave}
          onTempChange={handleDeployTempChange}
          onToggleReveal={toggleReveal}
          onCopy={handleCopy}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-8 right-8 z-50 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-white"
          style={{
            fontFamily: POPPINS,
            background: toast === "Saved!" ? "rgba(22,163,74,0.95)" : "rgba(239,68,68,0.95)",
            boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
          }}
          role="status"
        >
          {toast === "Saved!" ? <Check size={16} /> : <AlertCircle size={16} />}
          {toast}
        </div>
      )}
    </div>
  );
}
