import { EngineEvent, EventPriority, OverlaySnapshot, StoredMatchEvent } from "../types";
import { SQLiteStorage } from "./sqlite/sqlite_storage";

export class StorageEngine {
  private ready = false;

  constructor(private readonly storage: SQLiteStorage) {}

  async init(): Promise<void> {
    await this.storage.init();
    this.ready = true;
  }

  persistEvent(event: EngineEvent, priority: EventPriority): void {
    if (!this.ready) {
      return;
    }

    const storedEvent: StoredMatchEvent = {
      matchGuid: readMatchGuid(event.data),
      eventType: event.type,
      timestamp: event.timestamp,
      priority,
      payload: event.data
    };

    this.storage.insertEvent(storedEvent).catch((error) => {
      console.error("[RL DATA ENGINE] Failed to persist event", error);
    });
  }

  persistSnapshot(snapshot: OverlaySnapshot): void {
    if (!this.ready) {
      return;
    }

    this.storage.insertSnapshot(snapshot).catch((error) => {
      console.error("[RL DATA ENGINE] Failed to persist snapshot", error);
    });
  }

  async close(): Promise<void> {
    this.ready = false;
    await this.storage.close();
  }
}

function readMatchGuid(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const value = (data as { MatchGuid?: unknown }).MatchGuid;
  return typeof value === "string" ? value : undefined;
}
