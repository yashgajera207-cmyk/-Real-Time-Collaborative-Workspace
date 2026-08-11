"use client";

import { AnimatePresence } from "framer-motion";
import { DocumentCard } from "./DocumentCard";
import type { DocumentSummary } from "@/types";

export function DocumentList({ documents }: { documents: DocumentSummary[] }) {
  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 p-10 text-center text-sm text-ink-400">
        No documents yet. Create one to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence>
        {documents.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} />
        ))}
      </AnimatePresence>
    </div>
  );
}
