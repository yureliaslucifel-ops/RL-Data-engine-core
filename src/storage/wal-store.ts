import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

type Update = { key: string; value: any };

export type ApplyUpdateFn = (state: Record<string, any>, upd: Update) => void;

export default class WALStore {
  dir: string;
  walFile: string;
  snapshotFile: string;
  tmpSnapshotFile: string;
  snapshotIntervalMs: number;
  snapshotEveryN: number;
  walFsync: boolean;
  applyUpdateFn: ApplyUpdateFn;
  state: Record<string, any> = {};
  private _queue: Array<{ update: Update; resolve: Function; reject: Function }> = [];
  private _processing = false;
  private _updatesSinceSnapshot = 0;
  private _walFd: fs.promises.FileHandle | null = null;
  private _snapshotTimer: NodeJS.Timeout | null = null;
  private _snapshotting = false;
  private _closed = false;

  constructor(opts: Partial<{
    dir: string;
    walFile: string;
    snapshotFile: string;
    snapshotIntervalMs: number;
    snapshotEveryN: number;
    walFsync: boolean;
    applyUpdateFn: ApplyUpdateFn;
  }> = {}) {
    this.dir = path.resolve(opts.dir || './data');
    this.walFile = path.join(this.dir, opts.walFile || 'wal.log');
    this.snapshotFile = path.join(this.dir, opts.snapshotFile || 'snapshot.json');
    this.tmpSnapshotFile = this.snapshotFile + '.tmp';
    this.snapshotIntervalMs = opts.snapshotIntervalMs ?? 5 * 60 * 1000;
    this.snapshotEveryN = opts.snapshotEveryN ?? 1000;
    this.walFsync = opts.walFsync ?? true;
    this.applyUpdateFn = opts.applyUpdateFn ?? ((state, upd) => {
      const { key, value } = upd;
      if (!key) return;
      state[key] = Object.assign(state[key] || {}, value);
    });
  }

  async init() {
    await fsp.mkdir(this.dir, { recursive: true });
    await this._restore();
    await this._openWal();
    this._snapshotTimer = setInterval(() => this._maybeSnapshot('timer'), this.snapshotIntervalMs);
  }

  private async _restore() {
    try {
      const snap = await fsp.readFile(this.snapshotFile);
      this.state = JSON.parse(snap.toString());
    } catch (e: any) {
      if (e.code !== 'ENOENT') console.warn('snapshot load error', e);
      this.state = {};
    }

    try {
      const data = await fsp.readFile(this.walFile, { encoding: 'utf8' });
      if (data) {
        const lines = data.split('\n').filter(Boolean);
        for (const l of lines) {
          try {
            const upd: Update = JSON.parse(l);
            this.applyUpdateFn(this.state, upd);
          } catch (err) {
            console.warn('wal line parse error', err);
          }
        }
      }
    } catch (e: any) {
      if (e.code !== 'ENOENT') console.warn('wal read error', e);
    }
  }

  private async _openWal() {
    this._walFd = await fsp.open(this.walFile, 'a');
  }

  async applyUpdate(update: Update) {
    if (this._closed) throw new Error('store closed');
    return new Promise<void>((resolve, reject) => {
      this._queue.push({ update, resolve, reject });
      if (!this._processing) this._processQueue().catch(err => console.error(err));
    });
  }

  private async _processQueue() {
    this._processing = true;
    while (this._queue.length) {
      const item = this._queue.shift()!;
      try {
        const line = JSON.stringify(item.update) + '\n';
        if (!this._walFd) throw new Error('wal fd not open');
        await this._walFd.write(line, null, 'utf8');
        if (this.walFsync) {
          await this._walFd.sync();
        }
        try {
          this.applyUpdateFn(this.state, item.update);
        } catch (e) {
          console.warn('applyUpdateFn error', e);
        }
        this._updatesSinceSnapshot++;
        if (this._updatesSinceSnapshot >= this.snapshotEveryN) {
          this._maybeSnapshot('count').catch(err => console.error('snapshot error', err));
        }
        item.resolve();
      } catch (err) {
        item.reject(err);
      }
    }
    this._processing = false;
  }

  private async _maybeSnapshot(reason: string) {
    if (this._snapshotting) return;
    this._snapshotting = true;
    try {
      const tmp = this.tmpSnapshotFile;
      const data = JSON.stringify(this.state);
      const fd = await fsp.open(tmp, 'w');
      try {
        await fd.writeFile(data, 'utf8');
        await fd.sync();
      } finally {
        await fd.close();
      }
      await fsp.rename(tmp, this.snapshotFile);

      if (this._walFd) {
        await this._walFd.close();
        await fsp.writeFile(this.walFile, '', 'utf8');
        await this._openWal();
      }
      this._updatesSinceSnapshot = 0;
    } catch (e) {
      console.error('snapshot failed', e);
    } finally {
      this._snapshotting = false;
    }
  }

  get(key: string) {
    return this.state[key];
  }

  getAll() {
    return this.state;
  }

  async close() {
    if (this._closed) return;
    if (this._snapshotTimer) clearInterval(this._snapshotTimer);
    while (this._processing || this._queue.length) {
      await new Promise(r => setTimeout(r, 50));
    }
    await this._maybeSnapshot('close');
    if (this._walFd) {
      await this._walFd.close();
      this._walFd = null;
    }
    this._closed = true;
  }
}
