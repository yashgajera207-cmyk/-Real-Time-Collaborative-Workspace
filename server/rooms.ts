import * as Y from "yjs";
import { Awareness, removeAwarenessStates } from "y-protocols/awareness";
import type { WebSocket } from "ws";
import type { DocumentRole } from "@prisma/client";
import { loadDocument } from "./persistence";

export interface RoomMember {
  socket: WebSocket;
  userId: string;
  role: DocumentRole;
  // Yjs/awareness clientIDs this socket has announced as its own. A
  // socket normally owns exactly one, but we track a set defensively -
  // it's what lets us correctly evict presence on disconnect without
  // trusting the client to tell us when it's leaving.
  clientIds: Set<number>;
  isAlive: boolean;
}

export interface Room {
  doc: Y.Doc;
  awareness: Awareness;
  members: Set<RoomMember>;
  loading: Promise<void>;
  // Counts applied edits since the last snapshot / search-index refresh,
  // so both can run "periodically" without a DB write on every keystroke.
  updatesSinceSnapshot: number;
  updatesSinceIndex: number;
}

// One room per open document, held for the lifetime of the process.
// Phase 4 adds idle eviction + rehydration; phase 1/2 keep every room
// resident, which is explicitly called out as the thing that needs
// fixing before this can run unbounded.
const rooms = new Map<string, Room>();

export async function getOrCreateRoom(documentId: string): Promise<Room> {
  let room = rooms.get(documentId);
  if (room) {
    await room.loading;
    return room;
  }

  const doc = new Y.Doc();
  // Awareness is intentionally never persisted - it's ephemeral presence
  // state (cursors, selections, "who's online"), not document content.
  const awareness = new Awareness(doc);
  const placeholder: Room = {
    doc,
    awareness,
    members: new Set(),
    loading: Promise.resolve(),
    updatesSinceSnapshot: 0,
    updatesSinceIndex: 0,
  };
  rooms.set(documentId, placeholder);

  placeholder.loading = (async () => {
    const loaded = await loadDocument(documentId);
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(loaded));
  })();

  await placeholder.loading;
  return placeholder;
}

export function addMember(documentId: string, member: RoomMember): void {
  rooms.get(documentId)?.members.add(member);
}

/**
 * Removes a member from a room and evicts every awareness clientID it
 * owned, which broadcasts a removal to everyone else still connected.
 * Called for BOTH graceful disconnects (close frame) and ungraceful ones
 * (heartbeat timeout) - the caller doesn't need to distinguish, which is
 * the whole point: presence has to be honest either way.
 */
export function removeMember(documentId: string, member: RoomMember): void {
  const room = rooms.get(documentId);
  if (!room) return;
  room.members.delete(member);
  if (member.clientIds.size > 0) {
    removeAwarenessStates(room.awareness, [...member.clientIds], "connection closed");
  }
}

export function roomSize(documentId: string): number {
  return rooms.get(documentId)?.members.size ?? 0;
}

export function getMembers(documentId: string): ReadonlySet<RoomMember> {
  return rooms.get(documentId)?.members ?? new Set();
}

export function getAllMembers(): ReadonlySet<RoomMember> {
  const all = new Set<RoomMember>();
  for (const room of rooms.values()) {
    for (const m of room.members) all.add(m);
  }
  return all;
}

export function getRoomCount(): number {
  return rooms.size;
}
