"use client";

import { useEffect, useState } from "react";
import * as Y from "yjs";
import { motion } from "framer-motion";
import { History, RotateCcw, X, Clock, User } from "lucide-react";
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
      className="flex h-full w-80 flex-col border-l border-ink-200/60 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3.5 bg-ink-50/50">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-800">
          <History className="h-4 w-4 text-accent-600" />
          <span>Version History</span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {canEdit && (
        <div className="flex gap-2 border-b border-ink-100 p-3 bg-white">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Version label (optional)"
            className="h-9 flex-1 rounded-xl border border-ink-200 px-3 text-xs outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/15"
          />
          <Button onClick={saveVersion} loading={saving} className="h-9 px-3 text-xs font-semibold">
            Save
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {versions.length === 0 && (
          <p className="p-4 text-center text-xs text-ink-400">No versions saved yet.</p>
        )}
        {versions.map((v) => {
          const isSelected = selectedId === v.id;
          return (
            <button
              key={v.id}
              onClick={() => selectVersion(v.id)}
              className={`block w-full rounded-xl px-3.5 py-3 text-left transition-colors ${
                isSelected
                  ? "bg-accent-50/80 border border-accent-200/80 font-medium"
                  : "hover:bg-ink-50 border border-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isSelected ? "text-accent-900" : "text-ink-900"}`}>
                  {v.label ?? "Autosave Snapshot"}
                </span>
                <span className="text-[10px] text-ink-400 font-mono">
                  {new Date(v.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-ink-500 mt-1">
                <Clock className="h-3 w-3 shrink-0 text-ink-400" />
                <span>{new Date(v.createdAt).toLocaleDateString()}</span>
                {v.createdByName && <span className="font-semibold">· {v.createdByName}</span>}
              </div>
            </button>
          );
        })}
      </div>

      {selectedId && diff && (
        <div className="max-h-64 overflow-y-auto border-t border-ink-200/60 bg-ink-50/30 p-3.5 space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
            Word Diff vs Current Doc
          </span>
          <div className="rounded-xl border border-ink-200 bg-white p-3 text-xs leading-relaxed max-h-36 overflow-y-auto shadow-2xs font-mono">
            {diff.map((part, i) => (
              <span
                key={i}
                className={
                  part.type === "added"
                    ? "bg-emerald-100 text-emerald-900 font-bold px-1 rounded-xs"
                    : part.type === "removed"
                      ? "bg-red-100 text-red-800 line-through px-1 rounded-xs"
                      : "text-ink-600 font-normal"
                }
              >
                {part.text}{" "}
              </span>
            ))}
          </div>
          {canEdit && (
            <Button
              onClick={() => restoreVersion(selectedId)}
              variant="secondary"
              className="w-full h-9 text-xs font-semibold shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 text-accent-600" />
              Restore this version
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
