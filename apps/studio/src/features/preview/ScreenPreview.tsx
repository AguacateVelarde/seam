import { ArrowLeft, Check, Clipboard } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { Segmented } from "../../components/ui/Segmented";
import { Select } from "../../components/ui/Select";
import { useExperiments, usePreview, useScreens, useSnapshots } from "../../lib/hooks";
import { simulateBindings } from "../../lib/simulate";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { toast } from "../../store/toast";

type PreviewMode = "raw" | "simulated";

function labelOf(value: string | { id?: string; name?: string } | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.name ?? value.id ?? null;
}

export function ScreenPreview() {
  const { projectId = "", screenId = "" } = useParams();

  const screensQuery = useScreens(projectId);
  const screen = screensQuery.data?.find((s) => s.id === screenId);
  const snapshotsQuery = useSnapshots(projectId, screenId);
  const experimentsQuery = useExperiments(projectId);

  const activeExperiment = useMemo(() => {
    if (!screen?.activeExperiment) return undefined;
    return experimentsQuery.data?.find(
      (e) => e.id === screen.activeExperiment || e.name === screen.activeExperiment,
    );
  }, [screen, experimentsQuery.data]);

  const [mode, setMode] = useState<PreviewMode>("raw");
  const [userId, setUserId] = useState("");
  const [variant, setVariant] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [adapter, setAdapter] = useState("native");
  const [copied, setCopied] = useState(false);

  const debouncedParams = useDebouncedValue(
    {
      userId: userId || undefined,
      variant: variant || undefined,
      snapshotId: snapshotId || undefined,
      adapter: adapter !== "native" ? adapter : undefined,
    },
    400,
  );

  const previewQuery = usePreview(projectId, screen?.path, debouncedParams);

  const payload = previewQuery.data?.payload;
  const shown = mode === "simulated" ? simulateBindings(payload) : payload;
  const experimentLabel = labelOf(previewQuery.data?.experiment);
  const variantLabel = labelOf(previewQuery.data?.variant);

  async function copyCurl() {
    const command = previewQuery.data?.curlCommand;
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("curl command copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <Link
          to={`/${projectId}/screens/${screenId}`}
          className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
        >
          <ArrowLeft size={13} />
          Editor
        </Link>
        <h1 className="text-sm font-semibold text-slate-900">
          Preview{screen ? `: ${screen.name}` : ""}
        </h1>
        {experimentLabel && <Badge tone="purple">Experiment: {experimentLabel}</Badge>}
        {variantLabel && <Badge tone="blue">Variant: {variantLabel}</Badge>}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Controls */}
        <div className="w-72 shrink-0 space-y-4 overflow-y-auto border-r border-slate-200 bg-white p-4">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Mode</p>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "raw", label: "Raw" },
                { value: "simulated", label: "Simulated" },
              ]}
            />
          </div>

          <Field label="User ID" hint="Used for experiment allocation">
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="user_123"
            />
          </Field>

          <Field label="Force variant">
            <Select value={variant} onChange={(e) => setVariant(e.target.value)}>
              <option value="">No forced variant</option>
              {(activeExperiment?.variants ?? []).map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}
                </option>
              ))}
            </Select>
            {!activeExperiment && (
              <p className="mt-1 text-xs text-slate-400">No active experiment on this screen.</p>
            )}
          </Field>

          <Field label="Force snapshot">
            <Select value={snapshotId} onChange={(e) => setSnapshotId(e.target.value)}>
              <option value="">Active publication</option>
              {(snapshotsQuery.data ?? []).map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  v{snapshot.version}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Adapter">
            <Select value={adapter} onChange={(e) => setAdapter(e.target.value)}>
              <option value="native">Native</option>
              <option value="stac">Stac</option>
              <option value="divkit">DivKit</option>
            </Select>
          </Field>

          <Button
            variant="secondary"
            className="w-full"
            onClick={copyCurl}
            disabled={!previewQuery.data?.curlCommand}
          >
            {copied ? <Check size={14} /> : <Clipboard size={14} />}
            {copied ? "Copied" : "Copy curl"}
          </Button>
        </div>

        {/* Output */}
        <div className="min-w-0 flex-1 overflow-auto bg-slate-50 p-4">
          {previewQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading preview…</p>
          ) : previewQuery.isError ? (
            <p className="text-sm text-red-600">
              Preview failed:{" "}
              {previewQuery.error instanceof Error ? previewQuery.error.message : "unknown error"}
            </p>
          ) : (
            <pre className="min-h-full rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-emerald-100 shadow-inner">
              {JSON.stringify(shown ?? null, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
