"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function NewDocumentButton({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/workspaces/${workspaceId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    setLoading(false);
    if (!res.ok) {
      setError("Could not create that document.");
      return;
    }

    const doc = await res.json();
    setOpen(false);
    setTitle("");
    router.push(`/documents/${doc.id}`);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New document
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New document">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Title"
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled document"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">
            Create document
          </Button>
        </form>
      </Modal>
    </>
  );
}
