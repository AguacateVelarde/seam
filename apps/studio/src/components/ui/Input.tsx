import {
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  forwardRef,
} from "react";
import { cx } from "../../lib/cx";

const baseFieldClasses =
  "w-full rounded-md border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cx(
        baseFieldClasses,
        "h-9",
        error ? "border-red-500 focus:ring-red-200" : "border-slate-300",
        className,
      )}
      {...props}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, error, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cx(
        baseFieldClasses,
        "min-h-20 py-2",
        error ? "border-red-500 focus:ring-red-200" : "border-slate-300",
        className,
      )}
      {...props}
    />
  );
});

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cx("mb-1 block text-xs font-medium text-slate-600", className)} {...props} />
  );
}

export function Field({
  label,
  children,
  error,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  error?: string | null;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
