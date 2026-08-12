import Fastify from "fastify";
import websocketPlugin from "@fastify/websocket";
import * as Y from "yjs";
import { applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import type { WebSocket } from "ws";
import { authenticateConnection, roleAtLeast } from "./auth";
import { DocumentRole } from "@prisma/client";
import {
  getOrCreateRoom,
  addMember,
  removeMember,
  roomSize,
  getRoomCount,
  getMembers,
  getAllMembers,
  type RoomMember,
  type Room,
} from "./rooms";
import { appendUpdate, updateSearchText, createSnapshot } from "./persistence";
import { MSG_SYNC_STEP, MSG_UPDATE, MSG_AWARENESS, encodeMessage, decodeMessage } from "./protocol";

// Next.js route handlers cannot hold a persistent, long-lived, full-duplex
// connection open across requests - each invocation is a stateless
// request/response cycle (and on serverless targets, a cold-started one).
// A CRDT room needs one process holding an in-memory Y.Doc and live
// sockets for the room's entire lifetime. That's a plain Node process,
// not a route handler.

const PORT = Number(process.env.WS_PORT ?? 1234);
const HEARTBEAT_INTERVAL_MS = 10_000;

const app = Fastify({ logger: false });

app.register(websocketPlugin);

app.get("/healthz", async () => ({ ok: true, rooms: getRoomCount() }));

app.register(async (fastify) => {
  fastify.get("/ws", { websocket: true }, async (socket, req) => {
    const url = new URL(req.url ?? "", "http://internal");
    const documentId = url.searchParams.get("documentId") ?? undefined;
    const token = url.searchParams.get("token") ?? undefined;

    if (!documentId) {
      socket.close(4000, "missing documentId");
      return;
    }

    // --- Security boundary -------------------------------------------
    // Every connection is authenticated and authorised BEFORE it is
    // added to the room. An unauthorised socket receives nothing: not a
    // partial sync, not a presence update, nothing.
    let auth: { userId: string; role: DocumentRole };
    try {
      auth = await authenticateConnection(token, documentId);
    } catch (err) {
      req.log.warn({ err, documentId }, "rejected websocket connection");
      socket.close(4001, "unauthorized");
      return;
    }
    // -------------------------------------------------------------------

    const { userId, role } = auth;
    const room = await getOrCreateRoom(documentId);
    const member: RoomMember = {
      socket: socket as unknown as WebSocket,
      userId,
      role,
      clientIds: new Set(),
      isAlive: true,
    };
    addMember(documentId, member);

    req.log.info(
      { documentId, userId, role, roomSize: roomSize(documentId) },
      "socket joined room"
    );

    // Heartbeat: onclose only fires for polite exits. A train tunnel just
    // stops sending anything, no close frame included, and without a
    // ping/pong timeout the room's presence list would lie about who is
    // still there.
    socket.on("pong", () => {
      member.isAlive = true;
    });

    // Ask the client for its state vector rather than shipping the full
    // document - this is the delta-sync half of the handshake. The
    // client answers with its own SYNC_STEP once it gets ours, and each
    // side diffs against what the other is missing.
    const ourStateVector = Y.encodeStateVector(room.doc);
    socket.send(encodeMessage(MSG_SYNC_STEP, ourStateVector));

    // Send current presence so the newly joined client sees everyone
    // already in the room, not just people who join after them.
    const existingClientIds = [...room.awareness.getStates().keys()];
    if (existingClientIds.length > 0) {
      socket.send(
        encodeMessage(MSG_AWARENESS, encodeAwarenessUpdate(room.awareness, existingClientIds))
      );
    }

    socket.on("message", (raw: Buffer) => {
      void handleMessage(documentId, room, member, new Uint8Array(raw));
    });

    const cleanup = () => {
      removeMember(documentId, member);
      req.log.info(
        { documentId, userId, roomSize: roomSize(documentId) },
        "socket left room"
      );
    };

    socket.on("close", cleanup);
    socket.on("error", cleanup);
  });
});

async function handleMessage(
  documentId: string,
  room: Room,
  member: RoomMember,
  raw: Uint8Array
): Promise<void> {
  const { type, payload } = decodeMessage(raw);

  switch (type) {
    case MSG_SYNC_STEP: {
      // The peer told us their state vector; send back only what they're
      // missing, not the whole document.
      const theirStateVector = payload;
      const diff = Y.encodeStateAsUpdate(room.doc, theirStateVector);
      member.socket.send(encodeMessage(MSG_UPDATE, diff));
      app.log.info(
        { documentId, userId: member.userId, deltaBytes: diff.byteLength },
        "sent delta sync payload"
      );
      return;
    }

    case MSG_UPDATE: {
      // A viewer (or commenter, who can annotate but not edit body text)
      // may be connected and receiving broadcasts, but their edits are
      // never applied, never persisted, and never relayed to anyone
      // else. This is enforced here, server-side, where a hand-written
      // client can't work around it by skipping the UI gate.
      if (!roleAtLeast(member.role, DocumentRole.editor)) {
        app.log.warn(
          { documentId, userId: member.userId, role: member.role },
          "dropped update from a socket without edit rights"
        );
        return;
      }
      if (payload.byteLength === 0) return; // an empty diff carries nothing to apply

      Y.applyUpdate(room.doc, payload);
      await appendUpdate(documentId, member.userId, payload);
      broadcast(documentId, encodeMessage(MSG_UPDATE, payload), member.socket);

      // "Periodic": a search-index refresh every few edits, and a full
      // snapshot every 50, both amortised so a fast typist isn't
      // triggering a DB write per keystroke. Fire-and-forget - these are
      // best-effort background maintenance, not part of the durability
      // guarantee (that's appendUpdate above, which already happened).
      room.updatesSinceIndex += 1;
      room.updatesSinceSnapshot += 1;
      if (room.updatesSinceIndex >= 5) {
        room.updatesSinceIndex = 0;
        void updateSearchText(documentId, room.doc).catch((err) =>
          app.log.error({ err, documentId }, "search index refresh failed")
        );
      }
      if (room.updatesSinceSnapshot >= 50) {
        room.updatesSinceSnapshot = 0;
        void createSnapshot(documentId, room.doc, { label: "Autosave" }).catch((err) =>
          app.log.error({ err, documentId }, "periodic snapshot failed")
        );
      }
      return;
    }

    case MSG_AWARENESS: {
      // Presence isn't gated by edit rights - a viewer can still show a
      // cursor and be seen by everyone else with access to the document.
      applyAwarenessUpdate(room.awareness, payload, member);
      trackOwnedClientIds(room, member, payload);
      broadcast(documentId, encodeMessage(MSG_AWARENESS, payload), member.socket);
      return;
    }

    default:
      app.log.warn({ documentId, type }, "unknown message type, dropping");
  }
}

// The awareness protocol doesn't hand us "this clientID belongs to this
// socket" directly, so we peek at the state map after applying an update
// and record any clientID whose state now points at this member's user.
// It's used only to know which clientIDs to evict when this socket
// disconnects.
function trackOwnedClientIds(
  room: Room,
  member: RoomMember,
  updatePayload: Uint8Array
): void {
  void updatePayload;
  for (const [clientId, state] of room.awareness.getStates()) {
    const owner = (state as { userId?: string } | null)?.userId;
    if (owner === member.userId) member.clientIds.add(clientId);
  }
}

function broadcast(documentId: string, message: Uint8Array, exclude: WebSocket): void {
  for (const member of getMembers(documentId)) {
    if (member.socket === exclude) continue;
    if (member.socket.readyState !== member.socket.OPEN) continue;
    member.socket.send(message);
  }
}

// Sweep every open socket on an interval: ping it, and if it never
// answered the PREVIOUS ping, assume it's gone and force-close it. A
// dead train-tunnel connection never sends a close frame, so this is the
// only thing that notices it in a timely way.
setInterval(() => {
  for (const member of getAllMembers()) {
    if (!member.isAlive) {
      member.socket.terminate();
      continue;
    }
    member.isAlive = false;
    member.socket.ping();
  }
}, HEARTBEAT_INTERVAL_MS);

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
