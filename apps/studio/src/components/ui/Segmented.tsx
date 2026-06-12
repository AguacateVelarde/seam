import { cx } from "../../lib/cx";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cx(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
