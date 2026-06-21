import WALStore from "./wal-store";
import { EngineEvent, EventPriority, OverlaySnapshot, AccountStats } from "../types";

export class StorageEngine {
  private ready = false;

  constructor(private readonly store: WALStore) {}

  async init(): Promise<void> {
    await this.store.init();
    this.ready = true;
  }

  persistEvent(event: EngineEvent, priority: EventPriority): void {
    if (!this.ready) return;

    this.store.applyUpdate({
      key: "events",
      value: {
        type: event.type,
        timestamp: event.timestamp,
        priority,
        data: event.data
      }
    }).catch(console.error);
  }

  persistSnapshot(snapshot: OverlaySnapshot): void {
    if (!this.ready) return;

    this.store.applyUpdate({
      key: "snapshots",
      value: snapshot
    }).catch(console.error);
  }

  updateAccountStats(deltas: AccountStats[], seasonId?: string): void {
    if (!this.ready) return;

    this.store.applyUpdate({
      key: "account_stats",
      value: {
        seasonId,
        deltas
      }
    }).catch(console.error);
  }

  async close(): Promise<void> {
    this.ready = false;
    await this.store.close();
  }
}
