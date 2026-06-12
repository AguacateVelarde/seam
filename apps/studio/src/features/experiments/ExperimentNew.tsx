import { Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ulid } from "ulid";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { Segmented } from "../../components/ui/Segmented";
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { cx } from "../../lib/cx";
import { useCreateExperiment, useScreens, useSnapshots } from "../../lib/hooks";
import type { AllocationStrategy, VariantPatch } from "../../lib/types";
import { toast } from "../../store/toast";
import { PatchTree } from "./PatchTree";

interface VariantDraft {
  key: string;
  name: string;
  weightPct: string;
  patches: VariantPatch[];
}

function newVariantDraft(name: string, weightPct: string): VariantDraft {
  return { key: ulid(), name, weightPct, patches: [] };
}

export function ExperimentNew() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const createExperiment = useCreateExperiment(projectId);

  const { data: screens } = useScreens(projectId);

  const [name, setName] = useState("");
  const [screenId, setScreenId] = useState("");
  const [strategyType, setStrategyType] = useState<"user_id" | "percentage">("user_id");
  const [header, setHeader] = useState("X-User-Id");
  const [sticky, setSticky] = useState(false);
  const [ttlDays, setTtlDays] = useState("30");
  const [variants, setVariants] = useState<VariantDraft[]>([
    newVariantDraft("control", "50"),
    newVariantDraft("treatment", "50"),
  ]);

  // The latest snapshot of the target screen is the reference tree patches
  // are defined against (delivery applies them to the published snapshot).
  const snapshotsQuery = useSnapshots(projectId, screenId);
  const referenceTree = snapshotsQuery.data?.[0]?.tree ?? null;
  const snapshotsLoaded = Boolean(screenId) && snapshotsQuery.isSuccess;

  const weightSum = variants.reduce((sum, v) => sum + (Number(v.weightPct) || 0), 0);
  const weightsValid = Math.abs(weightSum - 100) < 0.01;
  const variantsValid = variants.length >= 2 && variants.every((v) => v.name.trim());
  const canSubmit =
    Boolean(name.trim()) &&
    Boolean(screenId) &&
    weightsValid &&
    variantsValid &&
    !createExperiment.isPending;

  function patchVariant(key: string, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }

  function handleScreenChange(nextScreenId: string) {
    setScreenId(nextScreenId);
    // Patches reference node ids from the previous screen's tree — drop them.
    setVariants((prev) => prev.map((v) => ({ ...v, patches: [] })));
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
        screenId,
        strategy,
        variants: variants.map((v) => ({
          id: ulid(),
          name: v.name.trim(),
          weight: (Number(v.weightPct) || 0) / 100,
          patches: v.patches,
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
        <Field
          label="Target screen"
          hint="Variants are defined as patches against this screen's snapshot tree."
        >
          <Select value={screenId} onChange={(e) => handleScreenChange(e.target.value)}>
            <option value="">Select a screen…</option>
            {(screens ?? []).map((screen) => (
              <option key={screen.id} value={screen.id}>
                {screen.name} ({screen.path})
              </option>
            ))}
          </Select>
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

        {!screenId ? (
          <p className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Select a target screen to define per-variant patches.
          </p>
        ) : snapshotsQuery.isLoading ? (
          <p className="mb-3 text-xs text-slate-400">Loading snapshots…</p>
        ) : snapshotsLoaded && !referenceTree ? (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Create a snapshot of this screen first to define patches. You can still save the
            experiment with empty patches.
          </p>
        ) : null}

        <div className="space-y-3">
          {variants.map((variant) => (
            <div key={variant.key} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={variant.name}
                  onChange={(e) => patchVariant(variant.key, { name: e.target.value })}
                  placeholder="Variant name"
                  className="w-44"
                  error={!variant.name.trim()}
                />
                <div className="relative w-24 shrink-0">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={variant.weightPct}
                    onChange={(e) => patchVariant(variant.key, { weightPct: e.target.value })}
                    className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    style={{ paddingRight: "1.75rem" }}
                    error={!weightsValid}
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    %
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {variant.patches.length === 0
                    ? "No patches (serves the published base)"
                    : `${variant.patches.length} ${variant.patches.length === 1 ? "patch" : "patches"}`}
                </span>
                <div className="flex-1" />
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

              {referenceTree && (
                <div className="mt-3">
                  <PatchTree
                    tree={referenceTree}
                    patches={variant.patches}
                    onChange={(patches) => patchVariant(variant.key, { patches })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </form>
  );
}
