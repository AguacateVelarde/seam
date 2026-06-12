import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

export interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function Dropdown({
  trigger,
  items,
  align = "end",
}: {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "start" | "end";
}) {
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>{trigger}</RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align={align}
          sideOffset={4}
          className="z-50 min-w-44 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
        >
          {items.map((item) => (
            <RadixDropdown.Item
              key={item.label}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cx(
                "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs outline-none",
                "data-[highlighted]:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
                item.danger ? "text-red-600" : "text-slate-700",
              )}
            >
              {item.icon}
              {item.label}
            </RadixDropdown.Item>
          ))}
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
