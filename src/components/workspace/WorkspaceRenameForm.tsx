"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface WorkspaceRenameFormProps {
  workspaceId: string;
  currentName: string;
  isOwner: boolean;
  onError: (msg: string | null) => void;
}

export function WorkspaceRenameForm({ workspaceId, currentName, isOwner, onError }: WorkspaceRenameFormProps) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);

  const handleRenameWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

    setSavingName(true);
    setNameSuccess(false);
    onError(null);

    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    setSavingName(false);
    if (res.ok) {
      setNameSuccess(true);
      router.refresh();
      setTimeout(() => setNameSuccess(false), 2000);
    } else {
      const data = await res.json().catch(() => ({}));
      onError(data.error ?? "Failed to update workspace name");
    }
  };

  return (
    <form onSubmit={handleRenameWorkspace} className="space-y-3 p-4 rounded-2xl border border-ink-100 bg-ink-50/40">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-800">
        <Settings className="h-4 w-4 text-accent-600" />
        <span>Rename Workspace</span>
      </div>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workspace Name"
          required
        />
        <Button type="submit" loading={savingName} className="h-9 px-4 text-xs font-semibold shrink-0">
          Save
        </Button>
      </div>
      {nameSuccess && (
        <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" /> Workspace renamed successfully
        </p>
      )}
    </form>
  );
}
