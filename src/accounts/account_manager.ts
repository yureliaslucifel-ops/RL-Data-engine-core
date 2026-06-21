import { readFile, writeFile } from "fs/promises";
import { dirname } from "path";

export interface AccountEntry {
  accountId: string;
  primaryId: string;
  displayName?: string;
}

export class AccountManager {
  private entries: AccountEntry[] = [];
  private path: string;

  constructor(path = "config/accounts.json") {
    this.path = path;
  }

  async init(): Promise<void> {
    try {
      const raw = await readFile(this.path, "utf-8");
      this.entries = JSON.parse(raw) as AccountEntry[];
    } catch {
      this.entries = [];
    }
  }

  list(): AccountEntry[] {
    return [...this.entries];
  }

  findByPrimaryId(primaryId?: string): AccountEntry | undefined {
    if (!primaryId) return undefined;
    // exact match first
    const exact = this.entries.find((e) => e.primaryId === primaryId);
    if (exact) return exact;
    // also try normalizing by removing splitscreen suffix (Platform|Uid|Splitscreen -> Platform|Uid)
    const parts = primaryId.split("|");
    if (parts.length >= 2) {
      const normalized = parts.slice(0, 2).join("|");
      return this.entries.find((e) => e.primaryId === normalized);
    }
    return undefined;
  }

  async add(entry: AccountEntry): Promise<void> {
    // replace if primaryId exists
    const idx = this.entries.findIndex((e) => e.primaryId === entry.primaryId);
    if (idx >= 0) {
      this.entries[idx] = entry;
    } else {
      this.entries.push(entry);
    }

    await this.save();
  }

  async save(): Promise<void> {
    // ensure dir exists
    try {
      await import("fs").then((fs) => fs.promises.mkdir(dirname(this.path), { recursive: true }));
    } catch {
      // ignore
    }

    await writeFile(this.path, JSON.stringify(this.entries, null, 2), "utf-8");
  }
}

// export a default singleton that can be used across the app
export const accountManager = new AccountManager();
