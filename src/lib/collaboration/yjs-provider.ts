"use client";

import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import { IndexeddbPersistence } from "y-indexeddb";
import type { ConnectionState } from "@/types";
import { MSG_SYNC_STEP, MSG_UPDATE, MSG_AWARENESS, encodeMessage, decodeMessage } from "./sync-protocol";

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

    this.awareness.setLocalStateField("user", options.user);
    this.awareness.setLocalStateField("userId", options.userId);

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
    queueMicrotask(() => {
      if (!this.destroyed) {
        this.options.onStatusChange?.(status);
      }
    });
  }

  private emitSyncStats(stats: { deltaBytes: number; direction: "sent" | "received" }) {
    queueMicrotask(() => {
      if (!this.destroyed) {
        this.options.onSyncStats?.(stats);
      }
    });
  }

  private async connect(): Promise<void> {
    if (this.destroyed) return;
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

      const ourStateVector = Y.encodeStateVector(this.doc);
      ws.send(encodeMessage(MSG_SYNC_STEP, ourStateVector));

      const localUpdate = encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
      ws.send(encodeMessage(MSG_AWARENESS, localUpdate));
    };

    ws.onmessage = (event) => {
      const { type, payload } = decodeMessage(new Uint8Array(event.data as ArrayBuffer));

      switch (type) {
        case MSG_SYNC_STEP: {
          const diff = Y.encodeStateAsUpdate(this.doc, payload);
          this.emitSyncStats({ deltaBytes: diff.byteLength, direction: "sent" });
          if (diff.byteLength > 0) ws.send(encodeMessage(MSG_UPDATE, diff));
          return;
        }
        case MSG_UPDATE:
          this.emitSyncStats({ deltaBytes: payload.byteLength, direction: "received" });
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
    this.retryDelayMs = Math.min(this.retryDelayMs * 1.7, 15000);
    setTimeout(() => void this.connect(), delay + Math.random() * 300);
  }

  private handleLocalDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encodeMessage(MSG_UPDATE, update));
    }
  };

  private handleLocalAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => {
    if (origin === this) return;
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
