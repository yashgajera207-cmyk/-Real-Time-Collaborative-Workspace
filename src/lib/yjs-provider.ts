"use client";

import * as Y from "yjs";
import type { ConnectionState } from "@/types";

// A deliberately small client for our own wire protocol: every message,
// in both directions, is a raw binary Yjs update. There is no hosted
// sync service in this project, so this class - together with
// server/index.ts - IS the sync layer.

interface ProviderOptions {
  wsUrl: string;
  documentId: string;
  getToken: () => Promise<string>;
  doc: Y.Doc;
  onStatusChange?: (status: ConnectionState) => void;
}

export class QuillWebsocketProvider {
  private ws: WebSocket | null = null;
  private readonly doc: Y.Doc;
  private readonly options: ProviderOptions;
  private destroyed = false;
  private retryDelayMs = 500;

  constructor(options: ProviderOptions) {
    this.options = options;
    this.doc = options.doc;
    this.doc.on("update", this.handleLocalUpdate);
    void this.connect();
  }

  private setStatus(status: ConnectionState) {
    this.options.onStatusChange?.(status);
  }

  private async connect(): Promise<void> {
    if (this.destroyed) return;
    this.setStatus(this.retryDelayMs > 500 ? "reconnecting" : "connecting");

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
      this.setStatus("connected");
    };

    ws.onmessage = (event) => {
      const update = new Uint8Array(event.data as ArrayBuffer);
      // Tag the origin so handleLocalUpdate can skip echoing this
      // straight back to the server it just came from.
      Y.applyUpdate(this.doc, update, this);
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

  private handleLocalUpdate = (update: Uint8Array, origin: unknown) => {
    // Don't send back an update that we just received from the server.
    if (origin === this) return;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(update);
    }
  };

  destroy(): void {
    this.destroyed = true;
    this.doc.off("update", this.handleLocalUpdate);
    this.ws?.close();
  }
}
