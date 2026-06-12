import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Field, Input, Textarea } from "../../components/ui/Input";
import { useCreateScreen } from "../../lib/hooks";
import { slugifyPath } from "../../lib/types";

export function ScreenNew() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const createScreen = useCreateScreen(projectId);

  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [pathTouched, setPathTouched] = useState(false);
  const [description, setDescription] = useState("");

  function handleNameChange(value: string) {
    setName(value);
    if (!pathTouched) setPath(slugifyPath(value));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !path.trim()) return;
    try {
      const screen = await createScreen.mutateAsync({
        name: name.trim(),
        path: path.trim(),
        description: description.trim() || undefined,
      });
      navigate(`/${projectId}/screens/${screen.id}`);
    } catch {
      // handled globally
    }
  }

  return (
    <div className="mx-auto max-w-lg px-8 py-8">
      <h1 className="mb-6 text-lg font-semibold text-slate-900">New screen</h1>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Home Dashboard"
            autoFocus
          />
        </Field>
        <Field label="Path" hint="Used in delivery URLs, e.g. /v1/deliver/:projectId/screens/:path">
          <Input
            value={path}
            onChange={(e) => {
              setPathTouched(true);
              setPath(e.target.value);
            }}
            placeholder="home-dashboard"
            className="font-mono"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this screen show?"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Link to={`/${projectId}/screens`}>
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button type="submit" disabled={!name.trim() || !path.trim() || createScreen.isPending}>
            {createScreen.isPending ? "Creating…" : "Create screen"}
          </Button>
        </div>
      </form>
    </div>
  );
}
