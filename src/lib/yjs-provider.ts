"use client";

import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import { IndexeddbPersistence } from "y-indexeddb";
import type { ConnectionState } from "@/types";
import { MSG_SYNC_STEP, MSG_UPDATE, MSG_AWARENESS, encodeMessage, decodeMessage } from "./sync-protocol";

// A deliberately small client for our own wire protocol - see
// server/protocol.ts for the message shapes. There is no hosted sync
// service in this project; this class and server/index.ts together ARE
// the sync layer.
//
// Three things layer on top of the raw socket:
//  - y-indexeddb caches the doc locally, so editing survives closing the
//    tab, and reconnecting after being offline sends a real delta instead
//    of a full re-upload (the local cache already has most of it).
//  - y-protocols/awareness carries live cursors/selections/"who's here",
//    kept completely separate from document content and never persisted.
//  - reconnection uses exponential backoff with jitter so a flaky network
//    doesn't hammer the server with retries in lockstep.

export interface PresenceUser {
  name: string;
  color: string;
}

interface ProviderOptions {
  wsUrl: string;
  documentId: string;
  userId: string;
  user: PresenceUser;
  getToken: () => Promise<string>;
  doc: Y.Doc;
  onStatusChange?: (status: ConnectionState) => void;
  onSyncStats?: (stats: { deltaBytes: number; direction: "sent" | "received" }) => void;
}

export class QuillWebsocketProvider {
  readonly awareness: Awareness;

  private ws: WebSocket | null = null;
  private readonly doc: Y.Doc;
  private readonly options: ProviderOptions;
  private readonly indexeddb: IndexeddbPersistence | null = null;
  private destroyed = false;
  private retryDelayMs = 500;
  private hasConnectedBefore = false;

  constructor(options: ProviderOptions) {
    this.options = options;
    this.doc = options.doc;
    this.awareness = new Awareness(this.doc);

    // Local presence: who this tab is, so remote peers can render a
    // named, colored cursor. `userId` is a stable field other clients
    // don't render but the server relies on it to know which awareness
    // clientIDs belong to which authenticated socket.
    this.awareness.setLocalStateField("user", options.user);
    this.awareness.setLocalStateField("userId", options.userId);

    // Offline cache. `whenSynced` resolves once IndexedDB has loaded
    // whatever was cached from a previous session, which may already
    // contain edits made while this tab was offline.
    if (typeof window !== "undefined" && typeof indexedDB !== "undefined") {
      this.indexeddb = new IndexeddbPersistence(`quill:${options.documentId}`, this.doc);
    }

    this.doc.on("update", this.handleLocalDocUpdate);
    this.awareness.on("update", this.handleLocalAwarenessUpdate);

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.handleBeforeUnload);
    }

    void this.connect();
  }

  private setStatus(status: ConnectionState) {
    this.options.onStatusChange?.(status);
  }

  private async connect(): Promise<void> {
    if (this.destroyed || typeof window === "undefined" || typeof WebSocket === "undefined") return;
    this.setStatus(this.hasConnectedBefore ? "reconnecting" : "connecting");

    let token: string;
    try {
      token = await this.options.getToken();
    } catch {
      this.setStatus("offline");
      this.scheduleReconnect();
      return;
    }

    const url = `${this.options.wsUrl}/ws?documentId=${encodeURIComponent(
      this.options.documentId
    )}&token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      this.retryDelayMs = 500;
      this.hasConnectedBefore = true;
      this.setStatus("connected");

      // Kick off the delta-sync handshake with whatever we already have
      // (including anything restored from the offline cache).
      const ourStateVector = Y.encodeStateVector(this.doc);
      ws.send(encodeMessage(MSG_SYNC_STEP, ourStateVector));

      // Re-announce presence, since the server's awareness map for this
      // room won't remember us across a reconnect.
      const localUpdate = encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
      ws.send(encodeMessage(MSG_AWARENESS, localUpdate));
    };

    ws.onmessage = (event) => {
      const { type, payload } = decodeMessage(new Uint8Array(event.data as ArrayBuffer));

      switch (type) {
        case MSG_SYNC_STEP: {
          // The server told us its state vector - reply with only what
          // we have that it doesn't (this is where offline edits made
          // while disconnected get uploaded, as a delta, not a resend
          // of the whole document).
          const diff = Y.encodeStateAsUpdate(this.doc, payload);
          this.options.onSyncStats?.({ deltaBytes: diff.byteLength, direction: "sent" });
          if (diff.byteLength > 0) ws.send(encodeMessage(MSG_UPDATE, diff));
          return;
        }
        case MSG_UPDATE:
          this.options.onSyncStats?.({ deltaBytes: payload.byteLength, direction: "received" });
          Y.applyUpdate(this.doc, payload, this);
          return;
        case MSG_AWARENESS:
          applyAwarenessUpdate(this.awareness, payload, this);
          return;
      }
    };

    ws.onclose = () => {
      if (this.destroyed) return;
      this.setStatus("offline");
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    const delay = this.retryDelayMs;
    // Exponential backoff with full jitter, capped at 15s, so a flock of
    // clients reconnecting after a shared outage don't all retry on the
    // exact same tick.
    this.retryDelayMs = Math.min(this.retryDelayMs * 1.7, 15000);
    setTimeout(() => void this.connect(), delay + Math.random() * 300);
  }

  private handleLocalDocUpdate = (update: Uint8Array, origin: unknown) => {
    // Don't send back an update that we just received from the server.
    if (origin === this) return;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encodeMessage(MSG_UPDATE, update));
    }
    // If we're offline, the update is still applied to `this.doc` and
    // y-indexeddb persists it locally - it goes out as part of the
    // SYNC_STEP diff exchange the moment we reconnect.
  };

  private handleLocalAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => {
    if (origin === this) return; // came from the server, don't echo it back
    const changedClients = [...changes.added, ...changes.updated, ...changes.removed];
    if (changedClients.length === 0) return;
    if (this.ws?.readyState === WebSocket.OPEN) {
      const update = encodeAwarenessUpdate(this.awareness, changedClients);
      this.ws.send(encodeMessage(MSG_AWARENESS, update));
    }
  };

  private handleBeforeUnload = () => {
    this.destroy();
  };

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.doc.off("update", this.handleLocalDocUpdate);
    this.awareness.off("update", this.handleLocalAwarenessUpdate);
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.handleBeforeUnload);
    }
    this.awareness.destroy();
    void this.indexeddb?.destroy();
    this.ws?.close();
  }
}
