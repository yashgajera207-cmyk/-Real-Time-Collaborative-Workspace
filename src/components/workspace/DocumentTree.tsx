"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import { motion } from "framer-motion";

interface TreeNode {
  id: string;
  title: string;
  role: string;
}

function TreeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeNode[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const active = pathname === `/documents/${node.id}`;
  const canEdit = node.role === "owner" || node.role === "editor";

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && children === null) {
      const res = await fetch(`/api/documents/${node.id}/children`);
      setChildren(res.ok ? await res.json() : []);
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const draggedId = e.dataTransfer.getData("text/quill-document-id");
    if (!draggedId || draggedId === node.id || !canEdit) return;

    await fetch(`/api/documents/${draggedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: node.id }),
    });
    setChildren(null);
    setExpanded(true);
    await toggleExpand();
    router.refresh();
  }

  return (
    <div>
      <motion.div
        layout
        draggable={canEdit}
        onDragStart={(e) => {
          (e as unknown as React.DragEvent).dataTransfer?.setData("text/quill-document-id", node.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{ paddingLeft: depth * 14 }}
        className={`group flex items-center gap-1 rounded-md py-1 pr-2 text-sm transition-colors
          ${active ? "bg-white font-medium text-ink-900 shadow-sm" : "text-ink-600 hover:bg-white/70"}
          ${dragOver ? "ring-2 ring-accent-400" : ""}`}
      >
        <button
          onClick={toggleExpand}
          className="flex h-4 w-4 shrink-0 items-center justify-center text-ink-400"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
        <FileText className="h-3.5 w-3.5 shrink-0 text-ink-400" />
        <Link href={`/documents/${node.id}`} className="truncate">
          {node.title}
        </Link>
      </motion.div>

      {expanded && children && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DocumentTree({ roots }: { roots: TreeNode[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {roots.map((node) => (
        <TreeItem key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}
