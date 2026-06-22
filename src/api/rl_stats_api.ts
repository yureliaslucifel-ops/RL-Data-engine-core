import { EventEmitter } from "events";
import net from "net";
import { EngineEvent, RocketLeagueMessage } from "../types";
import { accountManager } from "../accounts/account_manager";

export interface RLStatsAPIOptions {
  host?: string;
  port?: number;
  reconnectDelayMs?: number;
}

export class RLStatsAPI extends EventEmitter {
  private socket: net.Socket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = false;

  private host: string;
  private port: number;
  private reconnectDelayMs: number;

  constructor(options: RLStatsAPIOptions = {}) {
    super();

    this.host = options.host ?? "127.0.0.1";
    this.port = options.port ?? 49123;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 3000;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.open();
  }

  close(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  private open(): void {
    this.socket = new net.Socket();

    this.socket.connect(this.port, this.host, () => {
      this.emit("connect", {
        url: `tcp://${this.host}:${this.port}`
      });
    });

    let buffer = "";

    this.socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      const messages = buffer.split("\n");
      buffer = messages.pop() || "";

      for (const msg of messages) {
        const event = this.parse(msg);
        if (event) this.emit("event", event);
      }
    });

    this.socket.on("close", () => {
      this.emit("disconnect");
      this.reconnect();
    });

    this.socket.on("error", (err) => {
      this.emit("error", err);
    });
  }

  private reconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, this.reconnectDelayMs);
  }

private parse(raw: string): EngineEvent | null {
  try {
    const msg = JSON.parse(raw) as RocketLeagueMessage;

    if (!msg.Event) return null;

    let data = msg.Data;

    // 🔥 FIX IMPORTANT: double JSON encoding support
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }

    const event: EngineEvent = {
      type: msg.Event,
      timestamp: Date.now(),
      data
    };

    const players = (data as any)?.Players;

    if (Array.isArray(players)) {
      for (const p of players) {
        if (p?.PrimaryId) {
          const acc = accountManager.findByPrimaryId(p.PrimaryId);
          if (acc) {
            event.accountId = acc.accountId;
            break;
          }
        }
      }
    }

    return event;
  } catch {
    return null;
  }
}
}
