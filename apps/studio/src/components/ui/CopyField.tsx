import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "../../store/toast";
import { Button } from "./Button";
import { Input } from "./Input";

/** Read-only input with a copy button — used for one-time invite links and API keys. */
export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div className="mt-3 flex gap-2">
      <Input
        readOnly
        value={value}
        className="font-mono text-xs"
        onFocus={(e) => e.target.select()}
      />
      <Button variant="secondary" onClick={copy} className="shrink-0">
        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
