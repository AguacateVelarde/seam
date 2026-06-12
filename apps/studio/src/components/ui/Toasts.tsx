import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cx } from "../../lib/cx";
import { type ToastKind, useToastStore } from "../../store/toast";

const kindStyles: Record<ToastKind, string> = {
  success: "border-green-200 bg-green-50 text-green-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-slate-200 bg-white text-slate-700",
};

function ToastIcon({ kind }: { kind: ToastKind }) {
  if (kind === "success") return <CheckCircle2 size={15} className="shrink-0 text-green-600" />;
  if (kind === "error") return <AlertCircle size={15} className="shrink-0 text-red-600" />;
  return <Info size={15} className="shrink-0 text-slate-500" />;
}

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            "pointer-events-auto flex items-start gap-2 rounded-lg border p-3 text-sm shadow-lg",
            kindStyles[t.kind],
          )}
        >
          <ToastIcon kind={t.kind} />
          <span className="min-w-0 flex-1 break-words">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="shrink-0 opacity-50 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
