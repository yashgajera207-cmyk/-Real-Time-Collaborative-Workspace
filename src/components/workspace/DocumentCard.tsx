"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FileText } from "lucide-react";
import type { DocumentSummary } from "@/types";

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-accent-50 text-accent-800",
  editor: "bg-[#EAF3DE] text-[#173404]",
  commenter: "bg-[#FAEEDA] text-[#412402]",
  viewer: "bg-ink-100 text-ink-600",
};

export function DocumentCard({ doc }: { doc: DocumentSummary }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
    >
      <Link
        href={`/documents/${doc.id}`}
        className="flex flex-col gap-3 rounded-xl border border-ink-100 bg-white p-4 transition-shadow hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <FileText className="h-5 w-5 text-ink-400" />
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGE[doc.role] ?? ""}`}>
            {doc.role}
          </span>
        </div>
        <p className="line-clamp-2 text-sm font-medium text-ink-900">{doc.title}</p>
        <p className="text-xs text-ink-400">
          Updated {new Date(doc.updatedAt).toLocaleDateString()}
        </p>
      </Link>
    </motion.div>
  );
}
