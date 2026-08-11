"use client";

import type { ConnectionState } from "@/types";
import { motion } from "framer-motion";

const CONFIG: Record<ConnectionState, { label: string; dot: string; text: string }> = {
  connected: { label: "Connected", dot: "bg-live-on", text: "text-live-on" },
  connecting: { label: "Connecting", dot: "bg-ink-400", text: "text-ink-600" },
  reconnecting: { label: "Reconnecting", dot: "bg-live-warn", text: "text-live-warn" },
  offline: { label: "Offline - changes saved locally", dot: "bg-live-off", text: "text-live-off" },
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
      className="flex items-center gap-2 rounded-full border border-ink-100 bg-white px-3 py-1 text-xs"
    >
      <span className="relative flex h-2 w-2">
        {state !== "offline" && (
          <span className={`absolute inline-flex h-full w-full animate-pulse-ring rounded-full ${cfg.dot}`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${cfg.dot}`} />
      </span>
      <span className={`font-medium ${cfg.text}`}>{cfg.label}</span>
      {lastDeltaBytes != null && (
        <span className="text-ink-400">· {lastDeltaBytes}B</span>
      )}
    </motion.div>
  );
}
