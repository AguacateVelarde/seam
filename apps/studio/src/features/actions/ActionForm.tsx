import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ulid } from "ulid";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field, Input, Label, Textarea } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { useCreateAction, useUpdateAction } from "../../lib/hooks";
import type { Action, ActionParam, ActionParamType } from "../../lib/types";
import { actionNameRegex } from "../../lib/types";
import { toast } from "../../store/toast";

const PARAM_TYPES: ActionParamType[] = ["string", "number", "boolean", "enum"];

interface ParamDraft {
  key: string;
  name: string;
  type: ActionParamType;
  required: boolean;
  description: string;
  values: string[];
  collapsed: boolean;
}

function draftsFromAction(action: Action): ParamDraft[] {
  return Object.entries(action.params ?? {}).map(([name, param]) => ({
    key: ulid(),
    name,
    type: param.type,
    required: param.required,
    description: param.description ?? "",
    values: param.values ?? [],
    collapsed: true,
  }));
}

function toActionParams(drafts: ParamDraft[]): Record<string, ActionParam> | undefined {
  const record: Record<string, ActionParam> = {};
  for (const draft of drafts) {
    const name = draft.name.trim();
    if (!name) continue;
    record[name] = {
      type: draft.type,
      values: draft.type === "enum" ? draft.values : undefined,
      required: draft.required,
      description: draft.description.trim() || undefined,
    };
  }
  return Object.keys(record).length > 0 ? record : undefined;
}

export function ActionForm({ projectId, existing }: { projectId: string; existing?: Action }) {
  const navigate = useNavigate();
  const createAction = useCreateAction(projectId);
  const updateAction = useUpdateAction(projectId);

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [drafts, setDrafts] = useState<ParamDraft[]>(existing ? draftsFromAction(existing) : []);

  const nameValid = actionNameRegex.test(name);
  const paramNames = drafts.map((d) => d.name.trim()).filter(Boolean);
  const hasDuplicateNames = new Set(paramNames).size !== paramNames.length;
  const enumMissingValues = drafts.some((d) => d.type === "enum" && d.values.length === 0);

  const isPending = createAction.isPending || updateAction.isPending;
  const canSubmit = nameValid && !hasDuplicateNames && !enumMissingValues && !isPending;

  function patchDraft(key: string, patch: Partial<ParamDraft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const params = toActionParams(drafts);
    try {
      if (existing) {
        await updateAction.mutateAsync({
          actionId: existing.id,
          body: { description: description.trim() || undefined, params },
        });
        toast.success(`Updated ${existing.name}`);
      } else {
        await createAction.mutateAsync({
          name,
          description: description.trim() || undefined,
          params,
        });
        toast.success(`Created ${name}`);
      }
      navigate(`/${projectId}/actions`);
    } catch {
      // handled globally
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6 px-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">
          {existing ? `Edit ${existing.name}` : "New action"}
        </h1>
        <div className="flex gap-2">
          <Link to={`/${projectId}/actions`}>
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button type="submit" disabled={!canSubmit}>
            {isPending ? "Saving…" : existing ? "Save changes" : "Create action"}
          </Button>
        </div>
      </div>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <Field
          label="Name"
          error={name && !nameValid ? "Must match namespace.verb, e.g. navigation.push" : null}
          hint={
            existing
              ? "Action names are immutable once created."
              : "namespace.verb, e.g. navigation.push or sheet.open"
          }
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={Boolean(name) && !nameValid}
            disabled={Boolean(existing)}
            placeholder="navigation.push"
            className="font-mono"
            autoFocus={!existing}
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this action do on the client?"
          />
        </Field>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Params</h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setDrafts((prev) => [
                ...prev,
                {
                  key: ulid(),
                  name: "",
                  type: "string",
                  required: false,
                  description: "",
                  values: [],
                  collapsed: false,
                },
              ])
            }
          >
            <Plus size={13} />
            Add param
          </Button>
        </div>

        {hasDuplicateNames && (
          <p className="mb-3 text-xs text-red-600">Param names must be unique.</p>
        )}

        {drafts.length === 0 ? (
          <p className="text-sm text-slate-400">No params defined yet.</p>
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
                    placeholder="paramName"
                    className="w-44 font-mono text-xs"
                  />
                  <Select
                    value={draft.type}
                    onChange={(e) =>
                      patchDraft(draft.key, { type: e.target.value as ActionParamType })
                    }
                    className="w-32"
                  >
                    {PARAM_TYPES.map((t) => (
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
                          placeholder="push, replace, modal"
                          className="font-mono text-xs"
                        />
                        {draft.values.length === 0 && (
                          <p className="mt-1 text-xs text-red-600">
                            Enum params need at least one value.
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={draft.description}
                        onChange={(e) => patchDraft(draft.key, { description: e.target.value })}
                        placeholder="What is this param for?"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </form>
  );
}
