import { Plus, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Segmented } from "../../components/ui/Segmented";
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { useActions, useComponents } from "../../lib/hooks";
import type { Action, ActionParam, Component, ComponentProp, PropValue } from "../../lib/types";
import { findNodeById, useEditorStore } from "../../store/editor";

/* ---------------------------- Action combobox --------------------------- */

function ActionCombobox({
  actions,
  value,
  onSelect,
  invalid,
}: {
  actions: Action[];
  value: string | undefined;
  onSelect: (action: Action) => void;
  invalid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = actions.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="relative">
      <Input
        value={open ? query : (value ?? "")}
        error={invalid}
        placeholder="Search actions…"
        className="font-mono text-xs"
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">No actions found</p>
          ) : (
            filtered.map((action) => (
              <button
                key={action.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(action);
                  setOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50"
              >
                <span className="font-mono font-medium text-slate-800">{action.name}</span>
                {action.description && (
                  <span className="ml-2 text-slate-400">{action.description}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Action param input ------------------------ */

function ActionParamInput({
  name,
  param,
  value,
  onChange,
}: {
  name: string;
  param: ActionParam;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="font-mono text-xs text-slate-600">{name}</span>
        <Badge tone="gray">{param.type}</Badge>
        {param.required && <span className="text-xs text-red-500">*</span>}
      </div>
      {param.type === "boolean" ? (
        <Switch checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
      ) : param.type === "enum" ? (
        <Select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(param.values ?? []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      ) : param.type === "number" ? (
        <Input
          type="number"
          value={typeof value === "number" ? String(value) : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      ) : (
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

/* ------------------------------- Prop row ------------------------------- */

function defaultStaticValue(def: ComponentProp): string | number | boolean {
  switch (def.type) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "enum":
      return def.values[0] ?? "";
    default:
      return "";
  }
}

function isValueEmpty(value: PropValue | undefined): boolean {
  if (!value) return true;
  if (value.type === "static") return value.value === "";
  if (value.type === "binding") return value.expression.trim() === "";
  return value.actionName === "";
}

function PropRow({
  name,
  def,
  value,
  onChange,
  actions,
}: {
  name: string;
  def: ComponentProp;
  value: PropValue | undefined;
  onChange: (value: PropValue) => void;
  actions: Action[];
}) {
  const invalid = Boolean(def.required && isValueEmpty(value));
  const mode: "static" | "binding" = value?.type === "binding" ? "binding" : "static";
  const staticValue = value?.type === "static" ? value.value : undefined;
  const actionValue = value?.type === "action" ? value : undefined;
  const selectedAction = actionValue
    ? actions.find((a) => a.name === actionValue.actionName)
    : undefined;

  function setMode(next: "static" | "binding") {
    if (next === mode && value) return;
    if (next === "binding") onChange({ type: "binding", expression: "" });
    else onChange({ type: "static", value: defaultStaticValue(def) });
  }

  function setParam(paramName: string, paramValue: unknown) {
    if (!actionValue) return;
    onChange({
      ...actionValue,
      params: { ...(actionValue.params ?? {}), [paramName]: paramValue },
    });
  }

  return (
    <div className="border-b border-slate-100 px-4 py-3">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="font-mono text-xs font-medium text-slate-700">{name}</span>
        <Badge tone="gray">{def.type}</Badge>
        {def.required && (
          <span className="text-xs font-semibold text-red-500" title="Required">
            *
          </span>
        )}
        {def.type !== "action" && (
          <span className="ml-auto">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "static", label: "Static" },
                { value: "binding", label: "Binding" },
              ]}
            />
          </span>
        )}
      </div>

      {def.type === "action" ? (
        <div className="space-y-3">
          <ActionCombobox
            actions={actions}
            value={actionValue?.actionName}
            invalid={invalid}
            onSelect={(action) => onChange({ type: "action", actionName: action.name, params: {} })}
          />
          {selectedAction && Object.keys(selectedAction.params ?? {}).length > 0 && (
            <div className="space-y-2 rounded-md bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Params
              </p>
              {Object.entries(selectedAction.params ?? {}).map(([paramName, param]) => (
                <ActionParamInput
                  key={paramName}
                  name={paramName}
                  param={param}
                  value={actionValue?.params?.[paramName]}
                  onChange={(v) => setParam(paramName, v)}
                />
              ))}
            </div>
          )}
        </div>
      ) : mode === "binding" ? (
        <Input
          value={value?.type === "binding" ? value.expression : ""}
          error={invalid}
          placeholder="{{ user.name }}"
          className="font-mono text-xs"
          onChange={(e) => onChange({ type: "binding", expression: e.target.value })}
        />
      ) : def.type === "boolean" ? (
        <Switch
          checked={staticValue === true}
          onCheckedChange={(checked) => onChange({ type: "static", value: checked })}
        />
      ) : def.type === "number" ? (
        <Input
          type="number"
          value={staticValue !== undefined ? String(staticValue) : ""}
          error={invalid}
          onChange={(e) => onChange({ type: "static", value: Number(e.target.value) || 0 })}
        />
      ) : def.type === "enum" ? (
        def.values.length <= 4 ? (
          <div className="flex flex-wrap gap-3">
            {def.values.map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name={`prop-${name}`}
                  checked={staticValue === option}
                  onChange={() => onChange({ type: "static", value: option })}
                  className="accent-slate-900"
                />
                {option}
              </label>
            ))}
          </div>
        ) : (
          <Select
            value={typeof staticValue === "string" ? staticValue : ""}
            error={invalid}
            onChange={(e) => onChange({ type: "static", value: e.target.value })}
          >
            <option value="">Select…</option>
            {def.values.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        )
      ) : (
        <Input
          value={typeof staticValue === "string" ? staticValue : ""}
          error={invalid}
          placeholder={def.type === "url" ? "https://…" : def.type === "currency" ? "$0.00" : ""}
          onChange={(e) => onChange({ type: "static", value: e.target.value })}
        />
      )}

      {invalid && <p className="mt-1 text-xs text-red-600">This prop is required.</p>}
    </div>
  );
}

/* ------------------------------ Props panel ----------------------------- */

export function PropsPanel({ projectId, readOnly }: { projectId: string; readOnly: boolean }) {
  const tree = useEditorStore((s) => s.tree);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const addCondition = useEditorStore((s) => s.addCondition);
  const removeCondition = useEditorStore((s) => s.removeCondition);
  const updateCondition = useEditorStore((s) => s.updateCondition);

  const { data: components } = useComponents(projectId);
  const { data: actions } = useActions(projectId);
  const [schemaOpen, setSchemaOpen] = useState(false);

  const node = selectedNodeId ? findNodeById(tree, selectedNodeId) : null;
  const component: Component | undefined = node
    ? components?.find((c) => c.name === node.component)
    : undefined;

  if (readOnly) {
    return (
      <Panel>
        <p className="p-4 text-sm text-slate-400">
          Viewing an older version (read-only). Restore it to make edits.
        </p>
      </Panel>
    );
  }

  if (!node) {
    return (
      <Panel>
        <p className="p-4 text-sm text-slate-400">Select a node to edit its props.</p>
      </Panel>
    );
  }

  function handlePropChange(propName: string, value: PropValue) {
    if (!node) return;
    updateNodeProps(node.id, { ...node.props, [propName]: value });
  }

  const editableProps = component
    ? Object.entries(component.props).filter(([, def]) => def.type !== "slot")
    : [];

  return (
    <Panel>
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{node.component}</p>
        {component ? (
          <button
            type="button"
            onClick={() => setSchemaOpen(true)}
            className="mt-0.5 text-xs text-blue-600 hover:underline"
          >
            View component schema
          </button>
        ) : (
          <p className="mt-0.5 text-xs text-amber-600">
            Component "{node.component}" is not in the catalog.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {component && editableProps.length === 0 && (
          <p className="p-4 text-xs text-slate-400">This component has no editable props.</p>
        )}
        {editableProps.map(([propName, def]) => (
          <PropRow
            key={propName}
            name={propName}
            def={def}
            value={node.props[propName]}
            onChange={(value) => handlePropChange(propName, value)}
            actions={actions ?? []}
          />
        ))}

        {/* Conditions */}
        <div className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Conditions
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addCondition(node.id, { expression: "", operator: "show" })}
            >
              <Plus size={13} />
              Add condition
            </Button>
          </div>
          {(node.conditions ?? []).length === 0 ? (
            <p className="text-xs text-slate-400">Always rendered.</p>
          ) : (
            <div className="space-y-2">
              {(node.conditions ?? []).map((condition, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={condition.expression}
                    placeholder="{{ user.is_premium }}"
                    className="font-mono text-xs"
                    onChange={(e) =>
                      updateCondition(node.id, index, {
                        ...condition,
                        expression: e.target.value,
                      })
                    }
                  />
                  <Segmented
                    value={condition.operator}
                    onChange={(operator) =>
                      updateCondition(node.id, index, { ...condition, operator })
                    }
                    options={[
                      { value: "show", label: "Show" },
                      { value: "hide", label: "Hide" },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => removeCondition(node.id, index)}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {component && (
        <Dialog
          open={schemaOpen}
          onOpenChange={setSchemaOpen}
          title={`${component.name} schema`}
          widthClassName="max-w-xl"
        >
          <pre className="overflow-x-auto rounded-md bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
            {JSON.stringify(component.props, null, 2)}
          </pre>
        </Dialog>
      )}
    </Panel>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-[320px] shrink-0 flex-col border-l border-slate-200 bg-white">
      {children}
    </div>
  );
}
