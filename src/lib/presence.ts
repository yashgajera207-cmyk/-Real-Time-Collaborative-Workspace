"use client";

import { useEffect, useState } from "react";
import type { Awareness } from "y-protocols/awareness";

// Same palette as the static Avatar component, so a person's colour is
// consistent whether they're shown as a live cursor or a static avatar.
const PALETTE = ["#8B5CF6", "#0EA5A0", "#E36B3A", "#D6417A", "#C98A0A", "#3B7DD8"];

export function colorForUser(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

export interface PresenceEntry {
  clientId: number;
  userId: string | undefined;
  name: string;
  color: string;
  isLocal: boolean;
}

/**
 * Subscribes to a Yjs Awareness instance and returns a React-friendly
 * live list of everyone currently present, re-rendering whenever anyone
 * joins, leaves, or updates their state. Used for both the avatar stack
 * and (indirectly, via the CollaborationCursor extension) live cursors.
 */
export function usePresence(awareness: Awareness | undefined): PresenceEntry[] {
  const [entries, setEntries] = useState<PresenceEntry[]>([]);

  useEffect(() => {
    if (!awareness) return;

    const sync = () => {
      const localId = awareness.doc.clientID;
      const list: PresenceEntry[] = [];
      awareness.getStates().forEach((state, clientId) => {
        const user = (state as { user?: { name?: string; color?: string }; userId?: string })
          .user;
        const userId = (state as { userId?: string }).userId;
        if (!user?.name) return;
        list.push({
          clientId,
          userId,
          name: user.name,
          color: user.color ?? colorForUser(user.name),
          isLocal: clientId === localId,
        });
      });
      list.sort((a, b) => (a.isLocal === b.isLocal ? 0 : a.isLocal ? -1 : 1));
      setEntries(list);
    };

    sync();
    awareness.on("change", sync);
    return () => awareness.off("change", sync);
  }, [awareness]);

  return entries;
}
