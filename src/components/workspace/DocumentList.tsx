"use client";

import { AnimatePresence } from "framer-motion";
import { FileText, Sparkles } from "lucide-react";
import { DocumentCard } from "./DocumentCard";
import type { DocumentSummary } from "@/types";

export function DocumentList({ documents }: { documents: DocumentSummary[] }) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-ink-200 bg-white/50 p-12 text-center shadow-xs">
        <div className="h-12 w-12 rounded-2xl bg-accent-50 text-accent-600 flex items-center justify-center mb-3">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-ink-900">No documents yet</h3>
        <p className="text-sm text-ink-500 max-w-sm mt-1">
          Create your first document to start collaborating with real-time sync.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence>
        {documents.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} />
        ))}
      </AnimatePresence>
    </div>
  );
}
