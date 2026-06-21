import { EventEmitter } from "events";
import WebSocket from "ws";
import { EngineEvent, RocketLeagueMessage } from "../types";
import { accountManager } from "../accounts/account_manager";

export class RLStatsAPI extends EventEmitter {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = false;

  constructor(
    private readonly host = "127.0.0.1",
    private readonly port = 49123,
    private readonly reconnectDelayMs = 3000
  ) {
    super();
  }

  connect(): void {
    this.shouldReconnect = true;
    this.open();
  }

  close(): void {
    this.shouldReconnect = false;
    if (this.socket) this.socket.close();
    this.socket = null;
  }

  private open(): void {
    const url = `ws://${this.host}:${this.port}`;
    this.socket = new WebSocket(url);

    this.socket.on("open", () => {
      this.emit("connect", { url });
    });

    this.socket.on("message", (data) => {
      const event = this.parse(data.toString());
      if (event) this.emit("event", event);
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

      const event: EngineEvent = {
        type: msg.Event,
        timestamp: Date.now(),
        data: msg.Data
      };

      // simple account resolution (safe)
      const players = (msg.Data as any)?.Players;
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
