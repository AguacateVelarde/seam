import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ulid } from "ulid";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field, Input, Label, Textarea } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { useCreateComponent, useUpdateComponent } from "../../lib/hooks";
import type { Component, ComponentProp, ComponentPropType, PropType } from "../../lib/types";
import { componentNameRegex } from "../../lib/types";
import { toast } from "../../store/toast";

const PROP_TYPES: ComponentPropType[] = [
  "string",
  "number",
  "boolean",
  "currency",
  "url",
  "action",
  "enum",
  "slot",
];

interface PropDraft {
  key: string;
  name: string;
  type: ComponentPropType;
  required: boolean;
  defaultValue: string;
  description: string;
  values: string[];
  collapsed: boolean;
}

function draftsFromComponent(component: Component): PropDraft[] {
  return Object.entries(component.props).map(([name, def]) => ({
    key: ulid(),
    name,
    type: def.type,
    required: def.required,
    defaultValue: def.defaultValue === undefined ? "" : String(def.defaultValue),
    description: def.description ?? "",
    values: def.type === "enum" ? def.values : [],
    collapsed: true,
  }));
}

function parseDefaultValue(draft: PropDraft): unknown {
  if (draft.defaultValue === "" || draft.type === "slot" || draft.type === "action") {
    return undefined;
  }
  if (draft.type === "number") return Number(draft.defaultValue) || 0;
  if (draft.type === "boolean") return draft.defaultValue === "true";
  return draft.defaultValue;
}

function toComponentProps(drafts: PropDraft[]): Record<string, ComponentProp> {
  const record: Record<string, ComponentProp> = {};
  for (const draft of drafts) {
    const name = draft.name.trim();
    if (!name) continue;
    const typed: PropType =
      draft.type === "enum"
        ? { type: "enum", values: draft.values }
        : ({ type: draft.type } as PropType);
    record[name] = {
      ...typed,
      required: draft.required,
      defaultValue: parseDefaultValue(draft),
      description: draft.description.trim() || undefined,
    };
  }
  return record;
}

function zodSource(drafts: PropDraft[]): string {
  const lines = drafts
    .filter((d) => d.name.trim())
    .map((draft) => {
      let expr: string;
      switch (draft.type) {
        case "string":
        case "currency":
          expr = "z.string()";
          break;
        case "url":
          expr = "z.string().url()";
          break;
        case "number":
          expr = "z.number()";
          break;
        case "boolean":
          expr = "z.boolean()";
          break;
        case "enum":
          expr = `z.enum([${draft.values.map((v) => JSON.stringify(v)).join(", ")}])`;
          break;
        case "action":
          expr = "ActionRefSchema";
          break;
        case "slot":
          expr = "z.array(NodeSchema)";
          break;
      }
      const dv = parseDefaultValue(draft);
      if (dv !== undefined) expr += `.default(${JSON.stringify(dv)})`;
      else if (!draft.required) expr += ".optional()";
      const key = /^[a-zA-Z_$][\w$]*$/.test(draft.name.trim())
        ? draft.name.trim()
        : JSON.stringify(draft.name.trim());
      return `  ${key}: ${expr},`;
    });
  return lines.length > 0 ? `z.object({\n${lines.join("\n")}\n})` : "z.object({})";
}

export function ComponentForm({
  projectId,
  existing,
}: {
  projectId: string;
  existing?: Component;
}) {
  const navigate = useNavigate();
  const createComponent = useCreateComponent(projectId);
  const updateComponent = useUpdateComponent(projectId);

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [drafts, setDrafts] = useState<PropDraft[]>(existing ? draftsFromComponent(existing) : []);

  const nameValid = componentNameRegex.test(name);
  const propNames = drafts.map((d) => d.name.trim()).filter(Boolean);
  const hasDuplicateNames = new Set(propNames).size !== propNames.length;
  const enumMissingValues = drafts.some((d) => d.type === "enum" && d.values.length === 0);
  const preview = useMemo(() => zodSource(drafts), [drafts]);

  const isPending = createComponent.isPending || updateComponent.isPending;
  const canSubmit = nameValid && !hasDuplicateNames && !enumMissingValues && !isPending;

  function patchDraft(key: string, patch: Partial<PropDraft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function addDraft() {
    setDrafts((prev) => [
      ...prev,
      {
        key: ulid(),
        name: "",
        type: "string",
        required: false,
        defaultValue: "",
        description: "",
        values: [],
        collapsed: false,
      },
    ]);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const props = toComponentProps(drafts);
    try {
      if (existing) {
        await updateComponent.mutateAsync({
          componentId: existing.id,
          body: { description: description.trim() || undefined, props },
        });
        toast.success(`Updated ${existing.name}`);
      } else {
        await createComponent.mutateAsync({
          name,
          description: description.trim() || undefined,
          props,
        });
        toast.success(`Created ${name}`);
      }
      navigate(`/${projectId}/components`);
    } catch {
      // handled globally
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6 px-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">
          {existing ? `Edit ${existing.name}` : "New component"}
        </h1>
        <div className="flex gap-2">
          <Link to={`/${projectId}/components`}>
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button type="submit" disabled={!canSubmit}>
            {isPending ? "Saving…" : existing ? "Save changes" : "Create component"}
          </Button>
        </div>
      </div>

      {/* Section 1: identity */}
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <Field
          label="Name"
          error={name && !nameValid ? "Must be PascalCase, e.g. ProductCard" : null}
          hint={
            existing
              ? "Component names are immutable once created."
              : "PascalCase, e.g. ProductCard"
          }
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={Boolean(name) && !nameValid}
            disabled={Boolean(existing)}
            placeholder="ProductCard"
            className="font-mono"
            autoFocus={!existing}
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this component render?"
          />
        </Field>
      </section>

      {/* Section 2: props builder */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Props</h2>
          <Button variant="secondary" size="sm" onClick={addDraft}>
            <Plus size={13} />
            Add prop
          </Button>
        </div>

        {hasDuplicateNames && (
          <p className="mb-3 text-xs text-red-600">Prop names must be unique.</p>
        )}

        {drafts.length === 0 ? (
          <p className="text-sm text-slate-400">No props defined yet.</p>
        ) : (
          <div className="space-y-2">
            {drafts.map((draft) => (
              <div key={draft.key} className="rounded-md border border-slate-200">
                <div className="flex items-center gap-2 p-2">
                  <button
                    type="button"
                    onClick={() => patchDraft(draft.key, { collapsed: !draft.collapsed })}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100"
                  >
                    {draft.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <Input
                    value={draft.name}
                    onChange={(e) => patchDraft(draft.key, { name: e.target.value })}
                    placeholder="propName"
                    className="w-44 font-mono text-xs"
                  />
                  <Select
                    value={draft.type}
                    onChange={(e) =>
                      patchDraft(draft.key, {
                        type: e.target.value as ComponentPropType,
                        defaultValue: "",
                      })
                    }
                    className="w-32"
                  >
                    {PROP_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                  <div className="ml-2 flex items-center gap-1.5">
                    <Switch
                      checked={draft.required}
                      onCheckedChange={(checked) => patchDraft(draft.key, { required: checked })}
                    />
                    <span className="text-xs text-slate-500">Required</span>
                  </div>
                  <div className="flex-1" />
                  <Badge tone="gray">{draft.type}</Badge>
                  <button
                    type="button"
                    onClick={() => setDrafts((prev) => prev.filter((d) => d.key !== draft.key))}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {!draft.collapsed && (
                  <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-3">
                    {draft.type === "enum" && (
                      <div>
                        <Label>Enum values (comma-separated)</Label>
                        <Input
                          value={draft.values.join(", ")}
                          error={draft.values.length === 0}
                          onChange={(e) =>
                            patchDraft(draft.key, {
                              values: e.target.value
                                .split(",")
                                .map((v) => v.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="primary, secondary, ghost"
                          className="font-mono text-xs"
                        />
                        {draft.values.length === 0 && (
                          <p className="mt-1 text-xs text-red-600">
                            Enum props need at least one value.
                          </p>
                        )}
                      </div>
                    )}

                    {draft.type !== "slot" && draft.type !== "action" && (
                      <div>
                        <Label>Default value</Label>
                        {draft.type === "boolean" ? (
                          <Select
                            value={draft.defaultValue}
                            onChange={(e) =>
                              patchDraft(draft.key, { defaultValue: e.target.value })
                            }
                            className="w-40"
                          >
                            <option value="">No default</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </Select>
                        ) : draft.type === "enum" ? (
                          <Select
                            value={draft.defaultValue}
                            onChange={(e) =>
                              patchDraft(draft.key, { defaultValue: e.target.value })
                            }
                            className="w-40"
                          >
                            <option value="">No default</option>
                            {draft.values.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Input
                            type={draft.type === "number" ? "number" : "text"}
                            value={draft.defaultValue}
                            onChange={(e) =>
                              patchDraft(draft.key, { defaultValue: e.target.value })
                            }
                            placeholder="Leave empty for no default"
                          />
                        )}
                      </div>
                    )}

                    <div>
                      <Label>Description</Label>
                      <Input
                        value={draft.description}
                        onChange={(e) => patchDraft(draft.key, { description: e.target.value })}
                        placeholder="What is this prop for?"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Live preview */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Generated schema</h2>
        <pre className="overflow-x-auto rounded-md bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
          {preview}
        </pre>
      </section>
    </form>
  );
}
