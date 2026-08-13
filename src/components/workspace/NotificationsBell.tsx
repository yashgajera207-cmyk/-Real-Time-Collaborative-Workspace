"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, MessageSquare, AtSign, CheckCheck } from "lucide-react";

interface NotificationEntry {
  id: string;
  type: "mention" | "comment_reply";
  message: string;
  read: boolean;
  createdAt: string;
  documentId: string;
  actorName: string;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) setNotifications(await res.json());
    } catch {
      // Ignore transient network errors during background polling
    }
  }

  useEffect(() => {
    void refresh();
    // Near real-time live notification polling every 3 seconds
    const interval = setInterval(refresh, 3_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Close notifications popover on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await Promise.all(
      notifications
        .filter((n) => !n.read)
        .map((n) =>
          fetch(`/api/notifications/${n.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ read: true }),
          })
        )
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-1.5 text-ink-400 hover:bg-white hover:text-ink-800 transition-colors"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-xs">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative">{unreadCount > 9 ? "9+" : unreadCount}</span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full -left-[156px] z-50 mb-2 max-h-80 w-[238px] overflow-y-auto rounded-2xl border border-ink-200/80 bg-white/95 backdrop-blur-md shadow-2xl p-1.5 space-y-0.5"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-ink-100/80 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-700">Notifications</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 text-[10px] font-bold">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] font-semibold text-accent-600 hover:text-accent-800 transition-colors"
                >
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="p-4 text-center text-xs text-ink-400">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={`/documents/${n.documentId}`}
                  onClick={() => {
                    void markRead(n.id);
                    setOpen(false);
                  }}
                  className={`flex items-start gap-2.5 rounded-xl p-2.5 text-xs transition-colors hover:bg-accent-50/60 ${
                    n.read ? "text-ink-500 bg-transparent" : "font-semibold text-ink-900 bg-amber-50/50 border border-amber-200/40"
                  }`}
                >
                  {n.type === "mention" ? (
                    <AtSign className="h-4 w-4 text-accent-600 shrink-0 mt-0.5" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 leading-snug">{n.message}</p>
                    <p className="mt-1 text-[10px] text-ink-400 font-normal">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
