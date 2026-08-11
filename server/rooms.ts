import * as Y from "yjs";
import type { WebSocket } from "ws";
import type { DocumentRole } from "@prisma/client";
import { loadDocument } from "./persistence";

export interface RoomMember {
  socket: WebSocket;
  userId: string;
  role: DocumentRole;
}

interface Room {
  doc: Y.Doc;
  members: Set<RoomMember>;
  loading: Promise<void>;
}

// One room per open document, held for the lifetime of the process.
// Phase 4 adds idle eviction + rehydration; phase 1 keeps every room
// resident for simplicity, which is explicitly called out as the thing
// that will need fixing before this can run unbounded.
const rooms = new Map<string, Room>();

export async function getOrCreateRoom(documentId: string): Promise<Room> {
  let room = rooms.get(documentId);
  if (room) {
    await room.loading;
    return room;
  }

  const doc = new Y.Doc();
  const placeholder: Room = { doc, members: new Set(), loading: Promise.resolve() };
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

export function removeMember(documentId: string, member: RoomMember): void {
  const room = rooms.get(documentId);
  room?.members.delete(member);
}

export function roomSize(documentId: string): number {
  return rooms.get(documentId)?.members.size ?? 0;
}

export function getMembers(documentId: string): ReadonlySet<RoomMember> {
  return rooms.get(documentId)?.members ?? new Set();
}

export function getRoomCount(): number {
  return rooms.size;
}
