"use client";

import { useEffect, useState } from "react";
import * as Y from "yjs";
import { motion } from "framer-motion";
import { History, RotateCcw, X } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/Button";
import { diffWords } from "@/lib/word-diff";

interface VersionSummary {
  id: string;
  label: string | null;
  createdAt: string;
  createdByName: string | null;
}

function plainTextFromDoc(doc: Y.Doc): string {
  return doc
    .getXmlFragment("prosemirror")
    .toString()
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = window.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function VersionHistoryPanel({
  documentId,
  liveDoc,
  editor,
  canEdit,
  onClose,
}: {
  documentId: string;
  liveDoc: Y.Doc;
  editor: Editor | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [diff, setDiff] = useState<ReturnType<typeof diffWords> | null>(null);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");

  async function refresh() {
    const res = await fetch(`/api/documents/${documentId}/versions`);
    if (res.ok) setVersions(await res.json());
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  async function selectVersion(id: string) {
    setSelectedId(id);
    setDiff(null);
    const res = await fetch(`/api/documents/${documentId}/versions/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { data: string };

    const snapshotDoc = new Y.Doc();
    Y.applyUpdate(snapshotDoc, base64ToUint8Array(data.data));

    const before = plainTextFromDoc(snapshotDoc);
    const after = plainTextFromDoc(liveDoc);
    setDiff(diffWords(before, after));
  }

  async function saveVersion() {
    setSaving(true);
    const res = await fetch(`/api/documents/${documentId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim() || undefined }),
    });
    setSaving(false);
    if (res.ok) {
      setLabel("");
      await refresh();
    }
  }

  async function restoreVersion(id: string) {
    if (!editor) return;
    if (!window.confirm("Restore this version? This adds a new edit on top of the current document - nothing is deleted from history.")) {
      return;
    }
    const res = await fetch(`/api/documents/${documentId}/versions/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { data: string };

    const snapshotDoc = new Y.Doc();
    Y.applyUpdate(snapshotDoc, base64ToUint8Array(data.data));
    const sourceFragment = snapshotDoc.getXmlFragment("prosemirror");
    const targetFragment = liveDoc.getXmlFragment("prosemirror");

    // Cloning the snapshot's content into the LIVE doc, inside a single
    // transaction, produces one ordinary CRDT update - it flows through
    // the same doc.on('update') -> provider -> server -> broadcast path
    // as any other edit, gets appended to the update log like anything
    // else, and every version already saved stays exactly where it was.
    // Restoring is just "make another edit", never a destructive rewrite.
    Y.transact(liveDoc, () => {
      targetFragment.delete(0, targetFragment.length);
      const clones = sourceFragment
        .toArray()
        .filter((item): item is Y.XmlElement | Y.XmlText => item instanceof Y.XmlElement || item instanceof Y.XmlText)
        .map((item) => item.clone());
      targetFragment.insert(0, clones);
    });

    onClose();
  }

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-full w-80 flex-col border-l border-ink-100 bg-white"
    >
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-900">
          <History className="h-4 w-4" /> Version history
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-50">
          <X className="h-4 w-4" />
        </button>
      </div>

      {canEdit && (
        <div className="flex gap-2 border-b border-ink-100 p-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Version name (optional)"
            className="h-8 flex-1 rounded-md border border-ink-200 px-2 text-xs outline-none focus:border-accent-400"
          />
          <Button onClick={saveVersion} loading={saving} className="px-2 py-1 text-xs">
            Save version
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 && (
          <p className="p-4 text-xs text-ink-400">No versions saved yet.</p>
        )}
        {versions.map((v) => (
          <button
            key={v.id}
            onClick={() => selectVersion(v.id)}
            className={`block w-full border-b border-ink-50 px-4 py-2.5 text-left text-xs ${
              selectedId === v.id ? "bg-accent-50" : "hover:bg-ink-50"
            }`}
          >
            <p className="font-medium text-ink-800">{v.label ?? "Autosave"}</p>
            <p className="text-ink-400">
              {new Date(v.createdAt).toLocaleString()} {v.createdByName ? `· ${v.createdByName}` : ""}
            </p>
          </button>
        ))}
      </div>

      {selectedId && diff && (
        <div className="max-h-64 overflow-y-auto border-t border-ink-100 p-3">
          <p className="mb-2 text-xs font-medium text-ink-500">Diff vs. current</p>
          <p className="text-xs leading-relaxed">
            {diff.map((part, i) => (
              <span
                key={i}
                className={
                  part.type === "added"
                    ? "bg-[#E1F5EE] text-[#04342C]"
                    : part.type === "removed"
                      ? "bg-[#FBE7E3] text-[#5C1200] line-through"
                      : "text-ink-600"
                }
              >
                {part.text}{" "}
              </span>
            ))}
          </p>
          {canEdit && (
            <Button
              onClick={() => restoreVersion(selectedId)}
              variant="secondary"
              className="mt-3 w-full px-2 py-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore this version
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
