"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useActivity, type ActivityEntry } from "@/context/ActivityContext";
import { MODULE_CONFIG } from "@/data/notifications";

function Toast({
  entry,
  onDismiss,
}: {
  entry: ActivityEntry;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(entry.id), 4500);
    return () => clearTimeout(t);
  }, [entry.id, onDismiss]);

  const { icon: Icon, bg } = MODULE_CONFIG[entry.module];

  return (
    <div
      role="status"
      className="flex w-[340px] max-w-[90vw] items-start gap-3 rounded-xl border p-3.5"
      style={{
        background: "#1a1a1a",
        borderColor: "rgba(255,255,255,0.12)",
        boxShadow: "0px 12px 40px 0px rgba(0,0,0,0.55)",
        animation: "pcmp-toast-in 220ms ease-out",
        fontFamily: "Poppins, sans-serif",
      }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: bg }}
      >
        <Icon size={16} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-white">
          <span className="font-semibold">{entry.userName}</span>{" "}
          <span className="text-white/80">{entry.message}</span>
        </p>
        <p className="mt-1 text-xs text-white/40">{entry.projectName}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(entry.id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 text-white/40 transition-colors duration-150 hover:text-white"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export default function Toaster() {
  const { toasts, dismissToast } = useActivity();

  return (
    <>
      <style>{`@keyframes pcmp-toast-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }`}</style>
      <div className="pointer-events-none fixed right-5 top-5 z-[100] flex flex-col gap-3">
        {toasts.slice(0, 3).map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast entry={t} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </>
  );
}
