"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";

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

  async function refresh() {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (res.ok) setNotifications(await res.json());
  }

  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-1.5 text-ink-400 hover:bg-white hover:text-ink-800"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-live-off text-[9px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute bottom-full left-0 z-30 mb-2 max-h-80 w-80 overflow-y-auto rounded-xl border border-ink-100 bg-white shadow-xl"
          >
            {notifications.length === 0 ? (
              <p className="p-4 text-xs text-ink-400">No notifications yet.</p>
            ) : (
              notifications.map((n) => {
                const parts = n.message.split(': "');
                const actionText = parts[0];
                const previewText = parts[1] ? parts[1].replace(/"$/, "") : null;
                return (
                  <Link
                    key={n.id}
                    href={`/documents/${n.documentId}`}
                    onClick={() => markRead(n.id)}
                    className={`block border-b border-ink-50 px-3.5 py-2.5 text-xs last:border-0 hover:bg-ink-50 ${
                      n.read ? "text-ink-600" : "bg-accent-50/40 text-ink-900 font-medium"
                    }`}
                  >
                    <p className="font-semibold text-ink-900">{actionText}</p>
                    {previewText && (
                      <p className="mt-1 line-clamp-2 border-l-2 border-accent-400 pl-2 text-[11px] italic text-ink-600">
                        "{previewText}"
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-ink-400">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </Link>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
