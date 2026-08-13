"use client";

import type { ConnectionState } from "@/types";
import { motion } from "framer-motion";

const CONFIG: Record<ConnectionState, { label: string; dot: string; text: string; bg: string }> = {
  connected: { label: "Connected", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200/80" },
  connecting: { label: "Connecting", dot: "bg-ink-400", text: "text-ink-600", bg: "bg-ink-100 border-ink-200" },
  reconnecting: { label: "Reconnecting", dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  offline: { label: "Offline (Local)", dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50 border-red-200" },
};

export function ConnectionStatus({
  state,
  lastDeltaBytes,
}: {
  state: ConnectionState;
  lastDeltaBytes?: number | null;
}) {
  const cfg = CONFIG[state];
  return (
    <motion.div
      layout
      title={
        lastDeltaBytes != null
          ? `Last sync transferred ${lastDeltaBytes} bytes`
          : undefined
      }
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-2xs transition-all ${cfg.bg}`}
    >
      <span className="relative flex h-2 w-2">
        {state !== "offline" && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${cfg.dot}`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${cfg.dot}`} />
      </span>
      <span className={cfg.text}>{cfg.label}</span>
      {lastDeltaBytes != null && (
        <span className="text-ink-400 font-normal">· {lastDeltaBytes}B</span>
      )}
    </motion.div>
  );
}
