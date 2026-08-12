"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import type { WorkspaceSummary } from "@/types";
import { DocumentTree } from "./DocumentTree";
import { WorkspaceSearch } from "./WorkspaceSearch";
import { NotificationsBell } from "./NotificationsBell";

interface DocSummary {
  id: string;
  title: string;
  parentId: string | null;
  role: string;
}

export function WorkspaceSidebar({
  workspaces,
  userName,
}: {
  workspaces: WorkspaceSummary[];
  userName: string;
}) {
  const pathname = usePathname();
  const activeWorkspace = workspaces.find((ws) => pathname?.includes(`/workspaces/${ws.id}`));
  const [docs, setDocs] = useState<DocSummary[]>([]);

  useEffect(() => {
    if (!activeWorkspace) {
      setDocs([]);
      return;
    }
    let cancelled = false;
    void fetch(`/api/workspaces/${activeWorkspace.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setDocs(data.documents);
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id]);

  const roots = docs.filter((d) => !d.parentId);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-ink-100 bg-ink-50/60">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-900 text-sm font-medium text-white">
          Q
        </div>
        <span className="font-medium text-ink-900">Quill</span>
      </div>

      <nav className="space-y-1 px-3">
        {workspaces.map((ws) => {
          const active = pathname?.includes(`/workspaces/${ws.id}`);
          return (
            <Link
              key={ws.id}
              href={`/workspaces/${ws.id}`}
              className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors
                ${active ? "text-ink-900" : "text-ink-600 hover:bg-white"}`}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm"
                  transition={{ duration: 0.18 }}
                />
              )}
              <LayoutGrid className="relative z-10 h-4 w-4" />
              <span className="relative z-10 truncate">{ws.name}</span>
            </Link>
          );
        })}
      </nav>

      <AnimatePresence>
        {activeWorkspace && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex flex-1 flex-col gap-3 overflow-hidden"
          >
            <WorkspaceSearch workspaceId={activeWorkspace.id} />
            <div className="flex-1 overflow-y-auto px-3">
              <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-ink-400">
                Pages
              </p>
              <DocumentTree roots={roots.map((r) => ({ id: r.id, title: r.title, role: r.role }))} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!activeWorkspace && <div className="flex-1" />}

      <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3">
        <span className="truncate text-xs text-ink-500">{userName}</span>
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="Sign out"
            className="rounded-md p-1.5 text-ink-400 hover:bg-white hover:text-ink-800"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
