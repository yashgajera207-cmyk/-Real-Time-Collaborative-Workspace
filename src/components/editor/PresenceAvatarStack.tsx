"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { PresenceEntry } from "@/lib/presence";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

export function PresenceAvatarStack({ entries }: { entries: PresenceEntry[] }) {
  const visible = entries.slice(0, 5);
  const overflow = entries.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      <AnimatePresence initial={false}>
        {visible.map((entry) => (
          <motion.div
            key={entry.clientId}
            layout
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.18 }}
            title={entry.isLocal ? `${entry.name} (you)` : entry.name}
            style={{ background: entry.color }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium
              text-white ring-2 ring-white"
          >
            {initials(entry.name)}
          </motion.div>
        ))}
      </AnimatePresence>
      {overflow > 0 && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-200 text-[11px] font-medium text-ink-700 ring-2 ring-white">
          +{overflow}
        </div>
      )}
    </div>
  );
}
