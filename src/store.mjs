import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class Store {
  constructor(dir) {
    fs.mkdirSync(dir, { recursive: true });
    this.dir = dir;
    this.db = new DatabaseSync(path.join(dir, 'grim.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, body TEXT NOT NULL, created TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS record_kind ON records(kind, created);
      CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  }
  list(kind, limit = 500) {
    return this.db.prepare('SELECT * FROM records WHERE kind=? ORDER BY created DESC, rowid DESC LIMIT ?').all(kind, limit)
      .map(row => ({ ...JSON.parse(row.body), id: row.id, created: row.created }));
  }
  add(kind, body) {
    const item = { ...body, id: randomUUID(), created: new Date().toISOString() };
    this.db.prepare('INSERT INTO records VALUES (?, ?, ?, ?)').run(item.id, kind, JSON.stringify(body), item.created);
    return item;
  }
  get(id, kind) { return this.list(kind, 10000).find(item => item.id === id); }
  update(id, kind, changes) {
    const old = this.get(id, kind);
    if (!old) throw Object.assign(new Error('Item not found'), { status: 404 });
    const item = { ...old, ...changes, id: old.id, created: old.created };
    this.db.prepare('UPDATE records SET body=? WHERE id=? AND kind=?').run(JSON.stringify(item), id, kind);
    return item;
  }
  remove(id, kind) { this.db.prepare('DELETE FROM records WHERE id=? AND kind=?').run(id, kind); }
  clear(kind) { this.db.prepare('DELETE FROM records WHERE kind=?').run(kind); }
  config(key, fallback) {
    const row = this.db.prepare('SELECT value FROM config WHERE key=?').get(key);
    return row ? JSON.parse(row.value) : fallback;
  }
  set(key, value) { this.db.prepare('INSERT OR REPLACE INTO config VALUES (?, ?)').run(key, JSON.stringify(value)); }
  close() { this.db.close(); }
}
