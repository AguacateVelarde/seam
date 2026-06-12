import { Plus, Search, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ulid } from "ulid";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Field, Input, Label } from "../../components/ui/Input";
import { Segmented } from "../../components/ui/Segmented";
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { cx } from "../../lib/cx";
import { formatDateTime, shortId } from "../../lib/format";
import { useCreateExperiment, useScreens, useSnapshots } from "../../lib/hooks";
import type { AllocationStrategy } from "../../lib/types";
import { toast } from "../../store/toast";

interface VariantDraft {
  key: string;
  name: string;
  weightPct: string;
  snapshotId: string;
}

function newVariantDraft(name: string, weightPct: string): VariantDraft {
  return { key: ulid(), name, weightPct, snapshotId: "" };
}

/* --------------------------- Snapshot picker --------------------------- */

function SnapshotPicker({
  projectId,
  open,
  onClose,
  onPick,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onPick: (snapshotId: string) => void;
}) {
  const { data: screens } = useScreens(projectId);
  const [screenId, setScreenId] = useState("");
  const snapshotsQuery = useSnapshots(projectId, screenId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="Pick a snapshot">
      <div className="space-y-4">
        <div>
          <Label>Screen</Label>
          <Select value={screenId} onChange={(e) => setScreenId(e.target.value)}>
            <option value="">Select a screen…</option>
            {(screens ?? []).map((screen) => (
              <option key={screen.id} value={screen.id}>
                {screen.name} ({screen.path})
              </option>
            ))}
          </Select>
        </div>
        {screenId && (
          <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
            {snapshotsQuery.isLoading ? (
              <p className="p-3 text-xs text-slate-400">Loading snapshots…</p>
            ) : (snapshotsQuery.data ?? []).length === 0 ? (
              <p className="p-3 text-xs text-slate-400">This screen has no snapshots yet.</p>
            ) : (
              (snapshotsQuery.data ?? []).map((snapshot) => (
                <button
                  key={snapshot.id}
                  type="button"
                  onClick={() => {
                    onPick(snapshot.id);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-800">v{snapshot.version}</span>
                  <span className="text-slate-400">{formatDateTime(snapshot.createdAt)}</span>
                  <span className="font-mono text-slate-400">{shortId(snapshot.id, 10)}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

/* ------------------------------- Page ---------------------------------- */

export function ExperimentNew() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const createExperiment = useCreateExperiment(projectId);

  const [name, setName] = useState("");
  const [strategyType, setStrategyType] = useState<"user_id" | "percentage">("user_id");
  const [header, setHeader] = useState("X-User-Id");
  const [sticky, setSticky] = useState(false);
  const [ttlDays, setTtlDays] = useState("30");
  const [variants, setVariants] = useState<VariantDraft[]>([
    newVariantDraft("Control", "50"),
    newVariantDraft("Variant B", "50"),
  ]);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const weightSum = variants.reduce((sum, v) => sum + (Number(v.weightPct) || 0), 0);
  const weightsValid = Math.abs(weightSum - 100) < 0.01;
  const variantsValid =
    variants.length >= 2 && variants.every((v) => v.name.trim() && v.snapshotId.trim());
  const canSubmit =
    Boolean(name.trim()) && weightsValid && variantsValid && !createExperiment.isPending;

  function patchVariant(key: string, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const strategy: AllocationStrategy =
      strategyType === "user_id"
        ? { type: "user_id", header: header.trim() || "X-User-Id", sticky: true }
        : { type: "percentage", sticky, ttlDays: Math.max(1, Number(ttlDays) || 30) };
    try {
      const experiment = await createExperiment.mutateAsync({
        name: name.trim(),
        strategy,
        variants: variants.map((v) => ({
          id: ulid(),
          name: v.name.trim(),
          weight: (Number(v.weightPct) || 0) / 100,
          snapshotId: v.snapshotId.trim(),
        })),
      });
      toast.success(`Created experiment ${experiment.name}`);
      navigate(`/${projectId}/experiments/${experiment.id}`);
    } catch {
      // handled globally
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6 px-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">New experiment</h1>
        <div className="flex gap-2">
          <Link to={`/${projectId}/experiments`}>
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button type="submit" disabled={!canSubmit}>
            {createExperiment.isPending ? "Creating…" : "Create experiment"}
          </Button>
        </div>
      </div>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="homepage-hero-test"
            autoFocus
          />
        </Field>
      </section>

      {/* Strategy */}
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Allocation strategy</h2>
        <Segmented
          value={strategyType}
          onChange={setStrategyType}
          options={[
            { value: "user_id", label: "User ID" },
            { value: "percentage", label: "Percentage" },
          ]}
        />
        {strategyType === "user_id" ? (
          <Field
            label="Header"
            hint="Requests are bucketed by the value of this header. Always sticky."
          >
            <Input
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              placeholder="X-User-Id"
              className="max-w-xs font-mono"
            />
          </Field>
        ) : (
          <div className="flex items-end gap-6">
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={sticky} onCheckedChange={setSticky} />
              <span className="text-sm text-slate-600">Sticky assignments</span>
            </div>
            <Field label="TTL (days)">
              <Input
                type="number"
                min={1}
                value={ttlDays}
                onChange={(e) => setTtlDays(e.target.value)}
                className="w-28"
              />
            </Field>
          </div>
        )}
      </section>

      {/* Variants */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Variants</h2>
          <div className="flex items-center gap-3">
            <span
              className={cx(
                "text-xs font-medium",
                weightsValid ? "text-green-600" : "text-red-600",
              )}
            >
              Total: {weightSum}%
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setVariants((prev) => [
                  ...prev,
                  newVariantDraft(`Variant ${String.fromCharCode(65 + prev.length)}`, "0"),
                ])
              }
            >
              <Plus size={13} />
              Add variant
            </Button>
          </div>
        </div>

        {!weightsValid && (
          <p className="mb-3 text-xs text-red-600">Variant weights must sum to 100%.</p>
        )}

        <div className="space-y-2">
          {variants.map((variant) => (
            <div key={variant.key} className="flex items-center gap-2">
              <Input
                value={variant.name}
                onChange={(e) => patchVariant(variant.key, { name: e.target.value })}
                placeholder="Variant name"
                className="w-40"
                error={!variant.name.trim()}
              />
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={variant.weightPct}
                  onChange={(e) => patchVariant(variant.key, { weightPct: e.target.value })}
                  className="w-24 pr-7"
                  error={!weightsValid}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  %
                </span>
              </div>
              <Input
                value={variant.snapshotId}
                onChange={(e) => patchVariant(variant.key, { snapshotId: e.target.value })}
                placeholder="Snapshot ID"
                className="flex-1 font-mono text-xs"
                error={!variant.snapshotId.trim()}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPickerFor(variant.key)}
                title="Browse snapshots"
              >
                <Search size={13} />
                Browse
              </Button>
              <button
                type="button"
                disabled={variants.length <= 2}
                onClick={() => setVariants((prev) => prev.filter((v) => v.key !== variant.key))}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                title={variants.length <= 2 ? "Experiments need at least 2 variants" : "Remove"}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <SnapshotPicker
        projectId={projectId}
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onPick={(snapshotId) => {
          if (pickerFor) patchVariant(pickerFor, { snapshotId });
        }}
      />
    </form>
  );
}
