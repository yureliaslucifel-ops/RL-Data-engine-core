import { EventEmitter } from "events";
import WebSocket from "ws";
import { EngineEvent, RocketLeagueMessage } from "../types";

export interface RLStatsAPIOptions {
  host?: string;
  port?: number;
  reconnectDelayMs?: number;
}

export class RLStatsAPI extends EventEmitter {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = false;

  private readonly host: string;
  private readonly port: number;
  private readonly reconnectDelayMs: number;

  constructor(options: RLStatsAPIOptions = {}) {
    super();
    this.host = options.host ?? "127.0.0.1";
    this.port = options.port ?? 49123;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 3000;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.openSocket();
  }

  close(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.socket?.close();
    this.socket = null;
  }

  private openSocket(): void {
    const url = `ws://${this.host}:${this.port}`;
    this.socket = new WebSocket(url);

    this.socket.on("open", () => {
      this.emit("connect", { url });
    });

    this.socket.on("message", (message) => {
      const event = this.parseMessage(message.toString("utf-8"));

      if (event) {
        this.emit("event", event);
      }
    });

    this.socket.on("close", () => {
      this.emit("disconnect");
      this.scheduleReconnect();
    });

    this.socket.on("error", (error) => {
      this.emit("error", error);
    });
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, this.reconnectDelayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private parseMessage(raw: string): EngineEvent | null {
    try {
      const message = JSON.parse(raw) as RocketLeagueMessage;

      if (!message.Event) {
        return null;
      }

      return {
        type: message.Event,
        timestamp: Date.now(),
        data: normalizeData(message.Data)
      };
    } catch {
      return null;
    }
  }
}

function normalizeData(data: unknown): unknown {
  if (typeof data !== "string") {
    return data ?? {};
  }

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}
