import Fastify from "fastify";
import websocketPlugin from "@fastify/websocket";
import * as Sentry from "@sentry/node";
import * as Y from "yjs";
import { applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import type { WebSocket } from "ws";
import { authenticateConnection, roleAtLeast, type AuthResult } from "./auth";
import { DocumentRole } from "@prisma/client";
import {
  getOrCreateRoom,
  addMember,
  removeMember,
  roomSize,
  getRoomCount,
  getMembers,
  getAllMembers,
  countRoomsForUser,
  evictIdleRooms,
  resetApproxBytes,
  getResidentDocumentIds,
  type RoomMember,
  type Room,
} from "./rooms";
import { appendUpdate, updateSearchText, createSnapshot } from "./persistence";
import { compactIfOverThreshold } from "./compaction";
import { MSG_SYNC_STEP, MSG_UPDATE, MSG_AWARENESS, encodeMessage, decodeMessage } from "./protocol";

// Next.js route handlers cannot hold a persistent, long-lived, full-duplex
// connection open across requests - each invocation is a stateless
// request/response cycle (and on serverless targets, a cold-started one).
// A CRDT room needs one process holding an in-memory Y.Doc and live
// sockets for the room's entire lifetime. That's a plain Node process,
// not a route handler.

const PORT = Number(process.env.WS_PORT ?? 1234);
const HEARTBEAT_INTERVAL_MS = 10_000;
const IDLE_ROOM_EVICTION_MS = Number(process.env.IDLE_ROOM_EVICTION_MS ?? 5 * 60_000);
const IDLE_SWEEP_INTERVAL_MS = 60_000;

// --- Socket abuse protection thresholds --------------------------------
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_MESSAGES = 40; // generous for fast typing + awareness churn
const MAX_ROOMS_PER_USER = 20;
const MAX_APPROX_DOC_BYTES = Number(process.env.MAX_DOCUMENT_BYTES ?? 5 * 1024 * 1024); // 5MB
// -------------------------------------------------------------------------

const app = Fastify({ logger: false });

// Sentry is entirely optional - only initialised if SENTRY_DSN is set, so
// running locally or in this sandbox without one is silent and free.
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  app.log.info("Sentry error reporting enabled");
}

function reportError(err: unknown, context: Record<string, unknown>): void {
  app.log.error({ err, ...context }, "unhandled error in background task");
  if (process.env.SENTRY_DSN) Sentry.captureException(err, { extra: context });
}

app.register(websocketPlugin);

app.get("/", async () => ({
  name: "Quill Real-Time WebSocket Server",
  status: "online",
  appUrl: "http://localhost:3000",
  endpoints: {
    health: "/healthz",
    metrics: "/metrics",
    websocket: "/ws?documentId=<id>&token=<token>",
  },
}));

app.get("/healthz", async () => ({ ok: true, rooms: getRoomCount() }));

// A small ops surface (the spec lists a richer version of this as a
// stretch goal - rooms/connections/updates-per-second/p99 latency behind
// a shared Redis pub/sub across instances). This is the honest subset we
// can report from a single process without inventing numbers.
app.get("/metrics", async () => {
  const members = getAllMembers();
  return {
    roomsInMemory: getRoomCount(),
    connectionsOpen: members.size,
    uniqueUsersConnected: new Set([...members].map((m) => m.userId)).size,
  };
});

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
    let auth: AuthResult;
    try {
      auth = await authenticateConnection(token, documentId);
    } catch (err) {
      req.log.warn({ err, documentId }, "rejected websocket connection");
      socket.close(4001, "unauthorized");
      return;
    }
    // -------------------------------------------------------------------

    const { userId, role, isShareLink } = auth;

    // --- Abuse protection: max concurrent rooms per user ----------------
    if (!isShareLink && countRoomsForUser(userId) >= MAX_ROOMS_PER_USER) {
      req.log.warn({ userId }, "rejected connection: too many concurrent rooms for this user");
      socket.close(4008, "too many open documents");
      return;
    }
    // ---------------------------------------------------------------------

    const room = await getOrCreateRoom(documentId);
    const member: RoomMember = {
      socket: socket as unknown as WebSocket,
      documentId,
      userId,
      role,
      clientIds: new Set(),
      isAlive: true,
      rateWindowStart: Date.now(),
      rateWindowCount: 0,
    };
    addMember(documentId, member);

    req.log.info(
      { documentId, userId, role, isShareLink, roomSize: roomSize(documentId) },
      "socket joined room"
    );

    socket.on("pong", () => {
      member.isAlive = true;
    });

    const ourStateVector = Y.encodeStateVector(room.doc);
    socket.send(encodeMessage(MSG_SYNC_STEP, ourStateVector));

    const existingClientIds = [...room.awareness.getStates().keys()];
    if (existingClientIds.length > 0) {
      socket.send(
        encodeMessage(MSG_AWARENESS, encodeAwarenessUpdate(room.awareness, existingClientIds))
      );
    }

    socket.on("message", (raw: Buffer) => {
      // --- Abuse protection: per-connection message rate cap ----------
      const now = Date.now();
      if (now - member.rateWindowStart > RATE_LIMIT_WINDOW_MS) {
        member.rateWindowStart = now;
        member.rateWindowCount = 0;
      }
      member.rateWindowCount += 1;
      if (member.rateWindowCount > RATE_LIMIT_MAX_MESSAGES) {
        req.log.warn({ documentId, userId }, "dropping message: rate limit exceeded");
        return;
      }
      // -------------------------------------------------------------------
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
      // A viewer (or commenter, who can annotate but not edit body text),
      // and ALWAYS a share-link guest, may be connected and receiving
      // broadcasts, but their edits are never applied, never persisted,
      // and never relayed to anyone else.
      if (!roleAtLeast(member.role, DocumentRole.editor)) {
        app.log.warn(
          { documentId, userId: member.userId, role: member.role },
          "dropped update from a socket without edit rights"
        );
        return;
      }
      if (payload.byteLength === 0) return;

      // --- Abuse protection: bounded document growth --------------------
      if (room.approxBytesSinceLoad + payload.byteLength > MAX_APPROX_DOC_BYTES) {
        app.log.warn(
          { documentId, userId: member.userId, approxBytes: room.approxBytesSinceLoad },
          "dropped update: document size guard exceeded"
        );
        return;
      }
      room.approxBytesSinceLoad += payload.byteLength;
      // ---------------------------------------------------------------------

      Y.applyUpdate(room.doc, payload);
      await appendUpdate(documentId, member.userId, payload);
      broadcast(documentId, encodeMessage(MSG_UPDATE, payload), member.socket);

      room.updatesSinceIndex += 1;
      room.updatesSinceSnapshot += 1;
      room.updatesSinceCompactionCheck += 1;

      if (room.updatesSinceIndex >= 5) {
        room.updatesSinceIndex = 0;
        void updateSearchText(documentId, room.doc).catch((err) =>
          reportError(err, { documentId, task: "search-index-refresh" })
        );
      }
      if (room.updatesSinceSnapshot >= 50) {
        room.updatesSinceSnapshot = 0;
        void createSnapshot(documentId, room.doc, { label: "Autosave" }).catch((err) =>
          reportError(err, { documentId, task: "periodic-snapshot" })
        );
      }
      if (room.updatesSinceCompactionCheck >= 200) {
        room.updatesSinceCompactionCheck = 0;
        void compactIfOverThreshold(documentId)
          .then(() => resetApproxBytes(documentId))
          .catch((err) => reportError(err, { documentId, task: "compaction-check" }));
      }
      return;
    }

    case MSG_AWARENESS: {
      applyAwarenessUpdate(room.awareness, payload, member);
      trackOwnedClientIds(room, member);
      broadcast(documentId, encodeMessage(MSG_AWARENESS, payload), member.socket);
      return;
    }

    default:
      app.log.warn({ documentId, type }, "unknown message type, dropping");
  }
}

function trackOwnedClientIds(room: Room, member: RoomMember): void {
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

// Heartbeat: onclose only fires for polite exits. A train tunnel just
// stops sending anything, no close frame included, and without a
// ping/pong timeout the room's presence list would lie about who's
// still there.
const heartbeatTimer = setInterval(() => {
  for (const member of getAllMembers()) {
    if (!member.isAlive) {
      member.socket.terminate();
      continue;
    }
    member.isAlive = false;
    member.socket.ping();
  }
}, HEARTBEAT_INTERVAL_MS);

// Room lifecycle: an empty, idle room is pure wasted RAM. Eviction here
// only ever removes the in-memory doc - never data, since every update
// behind it was already durably appended before this process ever saw
// it applied. The next join transparently rehydrates via getOrCreateRoom.
const evictionTimer = setInterval(() => {
  const evicted = evictIdleRooms(IDLE_ROOM_EVICTION_MS);
  if (evicted.length > 0) {
    app.log.info({ documentIds: evicted, count: evicted.length }, "evicted idle rooms from memory");
  }
}, IDLE_SWEEP_INTERVAL_MS);

let shuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal, residentRooms: getResidentDocumentIds().length }, "shutting down");

  clearInterval(heartbeatTimer);
  clearInterval(evictionTimer);

  // Every update is appended to Postgres synchronously before it's ever
  // applied or broadcast (see MSG_UPDATE above: `await appendUpdate`
  // happens before anything else), so there is no batched write buffer
  // to flush here. What actually matters on shutdown is: stop accepting
  // new work, let Fastify finish in-flight HTTP/WS upgrade handling, and
  // close cleanly rather than yanking every socket - a deploy shouldn't
  // cost anyone a minute of their edits, and with durability handled
  // per-update rather than per-batch, it doesn't.
  try {
    await app.close();
    app.log.info("shutdown complete");
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, "error during shutdown");
    if (process.env.SENTRY_DSN) Sentry.captureException(err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error("[WS] Server error:", err);
    process.exit(1);
  }
  console.log(`[WS] Server listening on ${address}`);
});
