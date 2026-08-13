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
  private httpPollTimer: ReturnType<typeof setInterval> | null = null;
  private isHttpSyncActive = false;

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

    // If wsUrl points to window.location.origin or is empty, use Vercel HTTP Sync
    const isVercelLocal =
      !this.options.wsUrl ||
      this.options.wsUrl.includes("vercel.app") ||
      this.options.wsUrl.startsWith("http://localhost") ||
      this.options.wsUrl.startsWith("ws://localhost");

    if (isVercelLocal && typeof window !== "undefined") {
      // Direct Vercel native HTTP sync
      await this.startHttpSync();
      return;
    }

    let token: string;
    try {
      token = await this.options.getToken();
    } catch {
      await this.startHttpSync();
      return;
    }

    const url = `${this.options.wsUrl}/ws?documentId=${encodeURIComponent(
      this.options.documentId
    )}&token=${encodeURIComponent(token)}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      this.ws = ws;
    } catch {
      await this.startHttpSync();
      return;
    }

    const wsTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        void this.startHttpSync();
      }
    }, 2500);

    ws.onopen = () => {
      clearTimeout(wsTimeout);
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
      clearTimeout(wsTimeout);
      if (this.destroyed) return;
      void this.startHttpSync();
    };

    ws.onerror = () => {
      clearTimeout(wsTimeout);
      ws.close();
      void this.startHttpSync();
    };
  }

  private async startHttpSync(): Promise<void> {
    if (this.destroyed || this.isHttpSyncActive) return;
    this.isHttpSyncActive = true;
    this.setStatus("connected");

    await this.fetchHttpState();

    if (typeof window !== "undefined") {
      // Poll remote edits & online presence every 1.5 seconds
      this.httpPollTimer = setInterval(() => {
        void this.fetchHttpState();
        // Heartbeat: push local awareness presence continuously so avatars & cursors stay online
        const update = encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
        void this.pushHttpAwareness(update);
      }, 1500);
    }
  }

  private async fetchHttpState(): Promise<void> {
    if (this.destroyed) return;
    try {
      const res = await fetch(`/api/documents/${this.options.documentId}/sync`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.state) {
        const binaryString = atob(data.state);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        Y.applyUpdate(this.doc, bytes, this);
        this.emitSyncStats({ deltaBytes: bytes.byteLength, direction: "received" });
      }

      // Apply remote user awareness presence and live cursors
      if (Array.isArray(data.awarenessStates)) {
        for (const base64Awareness of data.awarenessStates) {
          if (typeof base64Awareness === "string") {
            const binaryString = atob(base64Awareness);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            applyAwarenessUpdate(this.awareness, bytes, this);
          }
        }
      }
    } catch {
      // Ignore transient fetch errors
    }
  }

  private async pushHttpAwareness(awarenessUpdate: Uint8Array): Promise<void> {
    if (this.destroyed) return;
    try {
      let binaryString = "";
      for (let i = 0; i < awarenessUpdate.length; i++) {
        const byte = awarenessUpdate[i];
        if (byte !== undefined) binaryString += String.fromCharCode(byte);
      }
      const base64Awareness = btoa(binaryString);

      await fetch(`/api/documents/${this.options.documentId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awareness: base64Awareness, clientId: this.doc.clientID }),
      });
    } catch {
      // Ignore transient push errors
    }
  }

  private async pushHttpUpdate(update: Uint8Array): Promise<void> {
    if (this.destroyed) return;
    try {
      let binaryString = "";
      for (let i = 0; i < update.length; i++) {
        const byte = update[i];
        if (byte !== undefined) binaryString += String.fromCharCode(byte);
      }
      const base64Update = btoa(binaryString);

      await fetch(`/api/documents/${this.options.documentId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ update: base64Update }),
      });
      this.emitSyncStats({ deltaBytes: update.byteLength, direction: "sent" });
    } catch {
      // Ignore transient push errors
    }
  }

  private handleLocalDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encodeMessage(MSG_UPDATE, update));
    } else if (this.isHttpSyncActive) {
      void this.pushHttpUpdate(update);
    }
  };

  private handleLocalAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => {
    if (origin === this) return;
    const changedClients = [...changes.added, ...changes.updated, ...changes.removed];
    if (changedClients.length === 0) return;
    const update = encodeAwarenessUpdate(this.awareness, changedClients);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encodeMessage(MSG_AWARENESS, update));
    } else if (this.isHttpSyncActive) {
      void this.pushHttpAwareness(update);
    }
  };

  private handleBeforeUnload = () => {
    this.destroy();
  };

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.httpPollTimer) {
      clearInterval(this.httpPollTimer);
      this.httpPollTimer = null;
    }

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
