import { type SelectHTMLAttributes, forwardRef } from "react";
import { cx } from "../../lib/cx";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, error, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cx(
        "h-9 w-full rounded-md border bg-white px-2.5 text-sm text-slate-900",
        "focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50",
        error ? "border-red-500" : "border-slate-300",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
