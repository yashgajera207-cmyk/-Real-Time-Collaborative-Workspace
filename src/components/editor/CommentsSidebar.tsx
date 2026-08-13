"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Check, RotateCcw, AlertTriangle } from "lucide-react";
import type { ThreadEntry } from "@/lib/use-comments";
import type { WorkspaceMember } from "@/lib/use-workspace-members";
import { MentionComposer } from "./MentionComposer";
import { Avatar } from "@/components/ui/Avatar";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

interface CommentsSidebarProps {
  threads: ThreadEntry[];
  orphanedThreadIds: Set<string>;
  activeThreadId: string | null;
  onSelectThread: (id: string | null) => void;
  onReply: (threadId: string, body: string, mentionedUserIds: string[]) => unknown;
  onSetResolved: (threadId: string, resolved: boolean) => unknown;
  members: WorkspaceMember[];
  canComment: boolean;
}

export function CommentsSidebar({
  threads,
  orphanedThreadIds,
  activeThreadId,
  onSelectThread,
  onReply,
  onSetResolved,
  members,
  canComment,
}: CommentsSidebarProps) {
  if (threads.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-ink-400">
        <div className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <MessageSquare className="h-5 w-5" />
        </div>
        <h4 className="font-bold text-ink-800">No comments yet</h4>
        <p className="text-xs text-ink-500 max-w-xs leading-relaxed">
          Select any text in the document to start an anchored comment thread.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3.5 space-y-1">
      <div className="flex items-center justify-between pb-2 border-b border-ink-100 px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Comment Threads</span>
        <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold text-accent-700">
          {threads.filter((t) => !t.resolved).length} active
        </span>
      </div>

      <AnimatePresence initial={false}>
        {threads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isOrphaned = orphanedThreadIds.has(thread.id);
          return (
            <motion.div
              key={thread.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              onClick={() => onSelectThread(thread.id)}
              className={`cursor-pointer rounded-2xl border p-4 transition-all duration-150 ${
                isActive
                  ? "border-amber-400 bg-amber-50/60 shadow-xs ring-1 ring-amber-400/30"
                  : "border-ink-200/80 bg-white hover:border-ink-300 hover:shadow-2xs"
              } ${thread.resolved ? "opacity-60 bg-ink-50/50" : ""}`}
            >
              <p className="mb-2.5 line-clamp-2 border-l-2 border-amber-400 pl-2.5 text-xs italic text-ink-600 font-medium">
                "{thread.quotedText}"
              </p>

              {isOrphaned && (
                <div className="mb-2.5 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-100/60 p-2 text-[11px] font-semibold text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Commented text was deleted — thread orphaned.</span>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                {thread.comments.map((c) => (
                  <div key={c.id} className="text-xs space-y-1 bg-white/80 rounded-xl p-2.5 border border-ink-100/60 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Avatar name={c.author.name} size={18} />
                        <span className="font-bold text-ink-900">{c.author.name}</span>
                      </div>
                      <span className="text-[10px] text-ink-400 font-medium">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="text-ink-700 leading-relaxed pl-6">{c.body}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between pt-2 border-t border-ink-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void onSetResolved(thread.id, !thread.resolved);
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-ink-600 hover:text-ink-900 transition-colors"
                >
                  {thread.resolved ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5 text-ink-500" /> Reopen
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" /> Resolve
                    </>
                  )}
                </button>
              </div>

              {isActive && canComment && (
                <div className="mt-3 border-t border-ink-200/60 pt-3" onClick={(e) => e.stopPropagation()}>
                  <MentionComposer
                    members={members}
                    submitLabel="Reply"
                    placeholder="Reply, or @mention someone..."
                    onSubmit={(body, ids) => onReply(thread.id, body, ids)}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
