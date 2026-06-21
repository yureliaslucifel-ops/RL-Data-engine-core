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

  private buffer = "";

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
    this.socket?.destroy();
    this.socket = null;
  }

  private openSocket(): void {
    this.socket = new net.Socket();

    this.socket.connect(this.port, this.host, () => {
      this.emit("connect", { url: `tcp://${this.host}:${this.port}` });
    });

    this.socket.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString("utf8");

      let index: number;
      while ((index = this.buffer.indexOf("\n")) !== -1) {
        const raw = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + 1);

        if (!raw) continue;

        const event = this.parseMessage(raw);
        if (event) this.emit("event", event);
      }
    });

    this.socket.on("close", () => {
      this.emit("disconnect");
      this.scheduleReconnect();
    });

    this.socket.on("error", (err) => {
      this.emit("error", err);
    });
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) return;

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

      if (!message.Event) return null;

      const data = normalizeData(message.Data);

      const event: EngineEvent = {
        type: message.Event,
        timestamp: Date.now(),
        data
      };

      // simple account resolution (safe)
      try {
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

            if (!event.accountId && p?.Name) {
              const acc = accountManager
                .list()
                .find((a: any) => a.name === p.Name || a.displayName === p.Name);

              if (acc) {
                event.accountId = acc.accountId;
              }
            }
          }
        }
      } catch {
        // ignore resolution errors
      }

      return event;
    } catch {
      return null;
    }
  }
}

function normalizeData(data: unknown): unknown {
  if (typeof data !== "string") return data ?? {};

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}
