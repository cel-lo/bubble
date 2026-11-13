import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { State, Message } from "../domain/model";

/** what a message looks like on disk last time we wrote it; text only grows while streaming, so length + tail is enough */
const mark = (m: Message) => `${m.text.length}|${m.text.slice(-64)}|${m.kind ?? ""}|${JSON.stringify(m.meta ?? null)}`;

/**
 * State lives in one small row (projects, rooms without their messages, settings); messages live in their own table
 * and only the ones that changed since the last save are written. Data from before the split (messages inside the
 * state row) loads as it is and moves into the table on the first save.
 */
export class Store {
  readonly db: DatabaseSync;
  private written = new Map<string, string>(); // message id -> mark at last write
  /** a consistent copy of the whole database (works while Walt runs) */
  backup(file: string) {
    this.db.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
  }
  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(join(dir, "walt.sqlite"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL); CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, room TEXT NOT NULL, seq INTEGER NOT NULL, json TEXT NOT NULL); CREATE INDEX IF NOT EXISTS messages_room ON messages(room, seq); PRAGMA user_version=2;",
    );
  }
  load(): State {
    const row = this.db.prepare("SELECT json FROM state WHERE id=1").get() as { json: string } | undefined;
    if (!row)
      return {
        revision: 0,
        projects: [],
        rooms: [],
        asks: [],
        engines: [],
        personas: [],
        settings: { locale: "en", theme: "dark", idleMinutes: 15 },
      };
    const state: State = JSON.parse(row.json);
    const byRoom = new Map<string, Message[]>();
    for (const r of this.db.prepare("SELECT room, json FROM messages ORDER BY room, seq").all() as { room: string; json: string }[]) {
      const m: Message = JSON.parse(r.json);
      this.written.set(m.id, mark(m));
      if (!byRoom.has(r.room)) byRoom.set(r.room, []);
      byRoom.get(r.room)!.push(m);
    }
    for (const room of state.rooms) if (!room.messages?.length) room.messages = byRoom.get(room.id) ?? [];
    return state;
  }
  save(state: State, type = "state.updated") {
    state.revision++;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("INSERT OR REPLACE INTO state VALUES(1,?)")
        .run(JSON.stringify({ ...state, rooms: state.rooms.map((r) => ({ ...r, messages: [] })) }));
      const put = this.db.prepare("INSERT OR REPLACE INTO messages VALUES(?,?,?,?)");
      const live = new Set<string>();
      for (const r of state.rooms)
        r.messages.forEach((m, i) => {
          live.add(m.id);
          const k = mark(m);
          if (this.written.get(m.id) === k) return;
          put.run(m.id, r.id, i, JSON.stringify(m));
          this.written.set(m.id, k);
        });
      // messages of deleted chats
      const drop = this.db.prepare("DELETE FROM messages WHERE id=?");
      for (const id of [...this.written.keys()])
        if (!live.has(id)) {
          drop.run(id);
          this.written.delete(id);
        }
      this.db
        .prepare("INSERT INTO events(at,type,payload) VALUES(?,?,?)")
        .run(new Date().toISOString(), type, JSON.stringify({ revision: state.revision }));
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      // a failed write must be retried next time, so forget what we think is on disk
      this.written.clear();
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
