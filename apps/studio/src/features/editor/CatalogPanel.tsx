import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cx } from "../../lib/cx";
import type { Component } from "../../lib/types";

export const CATALOG_SEARCH_INPUT_ID = "catalog-search-input";

export function CatalogPanel({
  components,
  onAdd,
  disabled,
}: {
  components: Component[];
  onAdd: (component: Component) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const filtered = components
      .filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
    const byLetter = new Map<string, Component[]>();
    for (const component of filtered) {
      const letter = component.name[0]?.toUpperCase() ?? "#";
      const bucket = byLetter.get(letter) ?? [];
      bucket.push(component);
      byLetter.set(letter, bucket);
    }
    return [...byLetter.entries()];
  }, [components, query]);

  return (
    <div className="flex w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Components
        </p>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id={CATALOG_SEARCH_INPUT_ID}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components…"
            className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {components.length === 0 ? (
          <p className="px-2 py-4 text-xs text-slate-400">
            No components registered. Create components first to build a screen.
          </p>
        ) : groups.length === 0 ? (
          <p className="px-2 py-4 text-xs text-slate-400">No components match "{query}".</p>
        ) : (
          groups.map(([letter, group]) => (
            <div key={letter} className="mb-2">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {letter}
              </p>
              {group.map((component) => (
                <div
                  key={component.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{component.name}</p>
                    {component.description && (
                      <p className="truncate text-xs text-slate-400">{component.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onAdd(component)}
                    title={`Add ${component.name}`}
                    className={cx(
                      "rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-700",
                      "group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30",
                    )}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
