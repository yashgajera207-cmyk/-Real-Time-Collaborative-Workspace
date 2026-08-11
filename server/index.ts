import Fastify from "fastify";
import websocketPlugin from "@fastify/websocket";
import * as Y from "yjs";
import type { WebSocket } from "ws";
import { authenticateConnection, roleAtLeast } from "./auth";
import { DocumentRole } from "@prisma/client";
import { getOrCreateRoom, addMember, removeMember, roomSize, getRoomCount, getMembers } from "./rooms";
import { appendUpdate } from "./persistence";

// Next.js route handlers cannot hold a persistent, long-lived, full-duplex
// connection open across requests - each invocation is a stateless
// request/response cycle (and on serverless targets, a cold-started one).
// A CRDT room needs one process holding an in-memory Y.Doc and a live
// socket per member for the room's entire lifetime. That's a plain Node
// process, not a route handler.

const PORT = Number(process.env.WS_PORT ?? 1234);

const app = Fastify({ logger: false });

app.register(websocketPlugin);

app.get("/healthz", async () => ({ ok: true, rooms: getRoomCount() }));

app.register(async (fastify) => {
  fastify.get("/ws", { websocket: true }, async (connection, req) => {
    const socket = connection.socket;
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
    // partial sync, not an error with document contents, nothing.
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
    const member = { socket: socket as unknown as WebSocket, userId, role };
    addMember(documentId, member);

    req.log.info(
      { documentId, userId, role, roomSize: roomSize(documentId) },
      "socket joined room"
    );

    // Bring the newly joined client up to date with one merged update
    // representing the full current state, rather than replaying every
    // historical row individually over the wire.
    const initialState = Y.encodeStateAsUpdate(room.doc);
    socket.send(initialState);

    socket.on("message", (raw: Buffer) => {
      void handleClientUpdate(documentId, room.doc, member, new Uint8Array(raw));
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

async function handleClientUpdate(
  documentId: string,
  doc: Y.Doc,
  member: { socket: WebSocket; userId: string; role: DocumentRole },
  update: Uint8Array
): Promise<void> {
  // A viewer (or commenter, who can annotate but not edit body text) may
  // be connected and receiving broadcasts, but their edits are never
  // applied, never persisted, and never relayed to anyone else. This is
  // the "unauthorised socket should never receive a single update, and a
  // viewer can't broadcast" requirement, enforced server-side where a
  // client can't work around it.
  if (!roleAtLeast(member.role, DocumentRole.editor)) {
    app.log.warn(
      { documentId, userId: member.userId, role: member.role },
      "dropped update from a socket without edit rights"
    );
    return;
  }

  Y.applyUpdate(doc, update);
  await appendUpdate(documentId, member.userId, update);
  broadcast(documentId, update, member.socket);
}

function broadcast(documentId: string, update: Uint8Array, exclude: WebSocket): void {
  for (const member of getMembers(documentId)) {
    if (member.socket === exclude) continue;
    if (member.socket.readyState !== member.socket.OPEN) continue;
    member.socket.send(update);
  }
}

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
