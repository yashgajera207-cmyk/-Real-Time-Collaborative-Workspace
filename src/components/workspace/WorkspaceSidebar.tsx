"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutGrid, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import type { WorkspaceSummary } from "@/types";

export function WorkspaceSidebar({
  workspaces,
  userName,
}: {
  workspaces: WorkspaceSummary[];
  userName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-ink-100 bg-ink-50/60">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-900 text-sm font-medium text-white">
          Q
        </div>
        <span className="font-medium text-ink-900">Quill</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
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

      <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3">
        <span className="truncate text-xs text-ink-500">{userName}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Sign out"
          className="rounded-md p-1.5 text-ink-400 hover:bg-white hover:text-ink-800"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
