import * as Y from "yjs";
import { Awareness, removeAwarenessStates } from "y-protocols/awareness";
import type { WebSocket } from "ws";
import type { DocumentRole } from "@prisma/client";
import { loadDocument } from "./persistence";

export interface RoomMember {
  socket: WebSocket;
  documentId: string;
  userId: string;
  role: DocumentRole;
  // Yjs/awareness clientIDs this socket has announced as its own. A
  // socket normally owns exactly one, but we track a set defensively -
  // it's what lets us correctly evict presence on disconnect without
  // trusting the client to tell us when it's leaving.
  clientIds: Set<number>;
  isAlive: boolean;
  // --- abuse protection state, per connection -----------------------
  rateWindowStart: number;
  rateWindowCount: number;
}

export interface Room {
  doc: Y.Doc;
  awareness: Awareness;
  members: Set<RoomMember>;
  loading: Promise<void>;
  lastActivity: number;
  // Counts applied edits since the last snapshot / search-index refresh
  // / compaction check, so all three can run "periodically" without a
  // DB round-trip on every keystroke.
  updatesSinceSnapshot: number;
  updatesSinceIndex: number;
  updatesSinceCompactionCheck: number;
  // A cheap running proxy for "how much has been written to this room
  // since it was loaded" - the sum of applied update payload sizes, NOT
  // an exact document size (that would mean re-encoding the whole doc on
  // every keystroke). Good enough to catch a client hammering the room
  // with megabytes of edits; reset after a compaction actually shrinks
  // the persisted log.
  approxBytesSinceLoad: number;
}

// One room per open document, held for the lifetime of the process (or
// until the idle-eviction sweep below removes it). Held in memory, not
// database rows - phase 1's promise that "killing and restarting the
// server loses nothing" still holds, since every update is durably
// appended before it's ever applied here.
const rooms = new Map<string, Room>();

export async function getOrCreateRoom(documentId: string): Promise<Room> {
  let room = rooms.get(documentId);
  if (room) {
    await room.loading;
    room.lastActivity = Date.now();
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
    lastActivity: Date.now(),
    updatesSinceSnapshot: 0,
    updatesSinceIndex: 0,
    updatesSinceCompactionCheck: 0,
    approxBytesSinceLoad: 0,
  };
  rooms.set(documentId, placeholder);

  placeholder.loading = (async () => {
    // This is the "rehydrate transparently on the next join" half of the
    // room lifecycle: whoever evicted this room (see evictIdleRooms
    // below) already made sure everything was durably persisted, so
    // loading it back is just the same replay loadDocument always does.
    const loaded = await loadDocument(documentId);
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(loaded));
  })();

  await placeholder.loading;
  return placeholder;
}

export function addMember(documentId: string, member: RoomMember): void {
  const room = rooms.get(documentId);
  room?.members.add(member);
  if (room) room.lastActivity = Date.now();
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
  room.lastActivity = Date.now();
  if (member.clientIds.size > 0) {
    removeAwarenessStates(room.awareness, [...member.clientIds], "connection closed");
  }
}

export function markActivity(documentId: string): void {
  const room = rooms.get(documentId);
  if (room) room.lastActivity = Date.now();
}

export function resetApproxBytes(documentId: string): void {
  const room = rooms.get(documentId);
  if (room) room.approxBytesSinceLoad = 0;
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

export function countRoomsForUser(userId: string): number {
  let count = 0;
  for (const documentId of rooms.keys()) {
    const room = rooms.get(documentId)!;
    for (const m of room.members) {
      if (m.userId === userId) {
        count++;
        break;
      }
    }
  }
  return count;
}

export function getRoomCount(): number {
  return rooms.size;
}

export function getAllRoomIds(): string[] {
  return [...rooms.keys()];
}

/**
 * A room with zero connected members that hasn't seen activity in a
 * while is pure idle memory - every open room is a full Y.Doc sitting in
 * RAM, so without this, memory grows with "documents ever opened", not
 * "documents open right now", and the process eventually OOMs. Eviction
 * is safe precisely because nothing here is the durability boundary:
 * every update was already appended to Postgres before it was applied
 * to this in-memory doc, so dropping the doc from RAM loses nothing.
 */
export function evictIdleRooms(idleMs: number): string[] {
  const now = Date.now();
  const evicted: string[] = [];
  for (const [documentId, room] of rooms) {
    if (room.members.size === 0 && now - room.lastActivity > idleMs) {
      room.awareness.destroy();
      rooms.delete(documentId);
      evicted.push(documentId);
    }
  }
  return evicted;
}

/**
 * Used by graceful shutdown to know what's currently resident - not that
 * there's anything left to "flush" beyond what's already durable (see
 * the eviction comment above), but it's useful to log what was live at
 * shutdown time.
 */
export function getResidentDocumentIds(): string[] {
  return [...rooms.keys()];
}
