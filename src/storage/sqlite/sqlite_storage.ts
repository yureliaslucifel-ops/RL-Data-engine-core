import sqlite3 from "sqlite3";
import { dirname } from "path";
import { mkdir } from "fs/promises";
import { OverlaySnapshot, StoredMatchEvent } from "../../types";

export class SQLiteStorage {
  private db: sqlite3.Database | null = null;

  constructor(private readonly databasePath: string) {}

  async init(): Promise<void> {
    await mkdir(dirname(this.databasePath), { recursive: true });
    this.db = await openDatabase(this.databasePath);

    await this.run(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_guid TEXT,
        event_type TEXT NOT NULL,
        priority TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_guid TEXT,
        timestamp INTEGER NOT NULL,
        snapshot_json TEXT NOT NULL
      )
    `);

    await this.run("CREATE INDEX IF NOT EXISTS idx_events_match_guid ON events(match_guid)");
    await this.run("CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)");
  }

  async insertEvent(event: StoredMatchEvent): Promise<void> {
    await this.run(
      `
        INSERT INTO events (
          match_guid,
          event_type,
          priority,
          timestamp,
          payload_json
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [
        event.matchGuid ?? null,
        event.eventType,
        event.priority,
        event.timestamp,
        JSON.stringify(event.payload)
      ]
    );
  }

  async insertSnapshot(snapshot: OverlaySnapshot): Promise<void> {
    await this.run(
      `
        INSERT INTO snapshots (
          match_guid,
          timestamp,
          snapshot_json
        ) VALUES (?, ?, ?)
      `,
      [
        snapshot.state.matchGuid ?? snapshot.session.matchGuid ?? null,
        snapshot.timestamp,
        JSON.stringify(snapshot)
      ]
    );
  }

  async close(): Promise<void> {
    if (!this.db) {
      return;
    }

    const db = this.db;
    this.db = null;

    await new Promise<void>((resolve, reject) => {
      db.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  private async run(sql: string, params: unknown[] = []): Promise<void> {
    const db = this.ensureOpen();

    await new Promise<void>((resolve, reject) => {
      db.run(sql, params, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  private ensureOpen(): sqlite3.Database {
    if (!this.db) {
      throw new Error("SQLite database is not open");
    }

    return this.db;
  }
}

function openDatabase(databasePath: string): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(db);
    });
  });
}
