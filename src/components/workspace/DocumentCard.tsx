"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Clock, Trash2 } from "lucide-react";
import type { DocumentSummary } from "@/types";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-purple-50 text-purple-700 border-purple-200",
  editor: "bg-indigo-50 text-indigo-700 border-indigo-200",
  commenter: "bg-amber-50 text-amber-700 border-amber-200",
  viewer: "bg-ink-100 text-ink-600 border-ink-200",
};

export function DocumentCard({ doc }: { doc: DocumentSummary }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const roleLower = doc.role?.toLowerCase() ?? "";
  const isOwner = roleLower === "owner";

  function handleTrashClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isOwner || deleting) return;
    setShowConfirmModal(true);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok) {
        setShowConfirmModal(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to delete document");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3 }}
        transition={{ duration: 0.2 }}
      >
        <Link
          href={`/documents/${doc.id}`}
          className="group flex flex-col justify-between h-36 rounded-2xl border border-ink-200/80 bg-white p-5 shadow-2xs hover:shadow-card-hover hover:border-accent-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center group-hover:bg-accent-600 group-hover:text-white transition-colors">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ROLE_BADGE[roleLower] ?? "bg-ink-100 text-ink-600 border-ink-200"}`}>
                {doc.role}
              </span>
              {isOwner && (
                <button
                  type="button"
                  onClick={handleTrashClick}
                  disabled={deleting}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-30 shrink-0"
                  title="Delete document"
                  aria-label="Delete document"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div>
            <h3 className="line-clamp-1 text-base font-bold text-ink-900 group-hover:text-accent-600 transition-colors">
              {doc.title}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-ink-400 mt-1">
              <Clock className="h-3 w-3" />
              <span>Updated {new Date(doc.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </Link>
      </motion.div>

      <ConfirmModal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title={`Delete "${doc.title}"?`}
        description="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete Document"
      />
    </>
  );
}
