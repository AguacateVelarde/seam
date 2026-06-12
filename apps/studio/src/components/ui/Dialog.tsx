import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  widthClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  widthClassName?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <RadixDialog.Content
          className={cx(
            "fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
            "overflow-y-auto rounded-lg bg-white p-5 shadow-xl focus:outline-none",
            widthClassName ?? "max-w-lg",
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <RadixDialog.Title className="text-sm font-semibold text-slate-900">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X size={16} />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
