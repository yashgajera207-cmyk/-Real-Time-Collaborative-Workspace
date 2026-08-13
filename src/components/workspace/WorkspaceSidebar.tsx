"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutGrid, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import type { WorkspaceSummary } from "@/types";
import { DocumentTree } from "./DocumentTree";
import { WorkspaceSearch } from "./WorkspaceSearch";
import { NotificationsBell } from "./NotificationsBell";
import { Avatar } from "@/components/ui/Avatar";

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

  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocSummary[]>([]);

  // Determine active workspace ID from URL route or current document
  useEffect(() => {
    // 1. Direct workspace path: /workspaces/:id
    const matchWs = pathname?.match(/\/workspaces\/([^/]+)/);
    if (matchWs?.[1]) {
      setCurrentWorkspaceId(matchWs[1]);
      return;
    }

    // 2. Document path: /documents/:id -> fetch document to get its workspaceId
    const matchDoc = pathname?.match(/\/documents\/([^/]+)/);
    if (matchDoc?.[1]) {
      const docId = matchDoc[1];
      let cancelled = false;
      fetch(`/api/documents/${docId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data?.workspaceId) {
            setCurrentWorkspaceId(data.workspaceId);
          }
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }

    // 3. Fallback: default to first workspace if available
    const firstWs = workspaces[0];
    if (firstWs && !currentWorkspaceId) {
      setCurrentWorkspaceId(firstWs.id);
    }
  }, [pathname, workspaces, currentWorkspaceId]);

  // Fetch documents list for current workspace
  const refreshDocs = useCallback(async () => {
    if (!currentWorkspaceId) {
      setDocs([]);
      return;
    }
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents ?? []);
      }
    } catch {
      // Ignore transient fetch errors
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    void refreshDocs();
    const interval = setInterval(refreshDocs, 4_000);
    return () => clearInterval(interval);
  }, [refreshDocs]);

  const roots = docs.filter((d) => !d.parentId);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-ink-200/60 bg-ink-50/80 backdrop-blur-md">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100/80">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-900 text-xs font-bold text-white shadow-2xs group-hover:scale-105 transition-transform">
            Q
          </div>
          <span className="font-bold text-sm text-ink-900 tracking-tight">Quill</span>
        </Link>
        <span className="rounded-full bg-accent-50 border border-accent-200 px-2 py-0.5 text-[10px] font-semibold text-accent-700">
          Pro
        </span>
      </div>

      {/* Workspaces List */}
      <div className="px-3 pt-3">
        <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">
          Workspaces
        </p>
        <nav className="space-y-1">
          {workspaces.map((ws) => {
            const active = ws.id === currentWorkspaceId;
            return (
              <Link
                key={ws.id}
                href={`/workspaces/${ws.id}`}
                className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  active ? "text-ink-900 font-semibold" : "text-ink-600 hover:bg-white/80 hover:text-ink-900"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-white shadow-xs border border-ink-200/50"
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  />
                )}
                <LayoutGrid className={`relative z-10 h-4 w-4 shrink-0 ${active ? "text-accent-600" : "text-ink-400"}`} />
                <span className="relative z-10 truncate">{ws.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Active Workspace Search & Pages Tree */}
      <div className="mt-3 flex flex-1 flex-col gap-3 overflow-hidden border-t border-ink-100/60 pt-3">
        {currentWorkspaceId && <WorkspaceSearch workspaceId={currentWorkspaceId} />}

        <div className="flex-1 overflow-y-auto px-3">
          <div className="mb-1.5 px-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
              Pages & Documents
            </p>
          </div>

          {docs.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-ink-400">No documents yet.</p>
          ) : (
            <DocumentTree roots={roots.map((r) => ({ id: r.id, title: r.title, role: r.role }))} />
          )}
        </div>
      </div>

      {/* User Footer Profile */}
      <div className="flex items-center justify-between border-t border-ink-200/60 bg-white/50 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={userName} size={28} />
          <span className="truncate text-xs font-semibold text-ink-800">{userName}</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
