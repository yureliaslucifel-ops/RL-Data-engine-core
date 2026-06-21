import { EventEmitter } from "events";
import WebSocket from "ws";
import { EngineEvent, RocketLeagueMessage } from "../types";
import { accountManager } from "../accounts/account_manager";

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

      const data = normalizeData(message.Data);
      const event: EngineEvent = {
        type: message.Event,
        timestamp: Date.now(),
        data
      };

      // attempt to resolve accountId from payload
      try {
        // players array
        const maybePlayers = (data as any)?.Players;
        if (Array.isArray(maybePlayers)) {
          for (const p of maybePlayers) {
            if (p && p.PrimaryId) {
              const entry = accountManager.findByPrimaryId(p.PrimaryId);
              if (entry) {
                event.accountId = entry.accountId;
                break;
              }
            }
            if (p && p.Name && !event.accountId) {
              // fallback by name
              const byName = accountManager.list().find((e: any) => e.name === p.Name || e.displayName === p.Name);
              if (byName) {
                event.accountId = byName.accountId;
                // if primaryId found later we will enrich config automatically
                break;
              }
            }
          }
        }

        // scorer/assister/target
        const attemptFromField = (obj: any) => {
          if (!obj) return undefined;
          if (obj.PrimaryId) {
            const e = accountManager.findByPrimaryId(obj.PrimaryId);
            if (e) return e.accountId;
          }
          if (obj.Name) {
            const e = accountManager.list().find((x: any) => x.name === obj.Name || x.displayName === obj.Name);
            if (e) return e.accountId;
          }
          return undefined;
        };

        const scorer = (data as any)?.Scorer;
        if (scorer && !event.accountId) {
          const a = attemptFromField(scorer);
          if (a) event.accountId = a;
        }

        const assister = (data as any)?.Assister;
        if (assister && !event.accountId) {
          const a = attemptFromField(assister);
          if (a) event.accountId = a;
        }

        const target = (data as any)?.Target || (data as any)?.MainTarget;
        if (target && !event.accountId) {
          const a = attemptFromField(target);
          if (a) event.accountId = a;
        }

        // if we found a mapping by name but PrimaryId exists in payload, enrich config
        if (!event.accountId && Array.isArray(maybePlayers)) {
          for (const p of maybePlayers) {
            if (!p) continue;
            const byName = accountManager.list().find((e: any) => e.name === p.Name || e.displayName === p.Name);
            if (byName && p.PrimaryId) {
              // enrich and save
              (byName as any).primaryId = p.PrimaryId;
              accountManager.add(byName).catch(() => {});
            }
          }
        }
      } catch (e) {
        // ignore account resolution errors
      }

      return event;
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
