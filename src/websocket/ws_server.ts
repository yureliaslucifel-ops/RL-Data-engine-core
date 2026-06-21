import { WebSocket, WebSocketServer } from "ws";
import { EventBus } from "../core/event_bus";
import { PriorityRouter } from "../core/priority_router";
import { OverlayEventMessage } from "../types";
import { SnapshotBuilder } from "./snapshot_builder";

export interface WebSocketServerOptions {
  eventBus: EventBus;
  snapshotBuilder: SnapshotBuilder;
  priorityRouter: PriorityRouter;
  host?: string;
  port?: number;
}

export function startWebSocketServer(options: WebSocketServerOptions): WebSocketServer {
  const host = options.host ?? "0.0.0.0";
  const port = options.port ?? 8080;
  const server = new WebSocketServer({ host, port });

  server.on("connection", (client) => {
    send(client, options.snapshotBuilder.buildFullSnapshot());
  });

  options.eventBus.on("ANY", (event) => {
    const payload: OverlayEventMessage & { priority: string } = {
      type: "event",
      timestamp: Date.now(),
      event,
      snapshot: options.snapshotBuilder.buildFullSnapshot(),
      priority: options.priorityRouter.getPriority(event)
    };

    for (const client of server.clients) {
      send(client, payload);
    }
  });

  return server;
}

function send(client: WebSocket, payload: unknown): void {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(payload));
  }
}
