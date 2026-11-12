import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { State } from "../domain/model";
export class Store {
  readonly db: DatabaseSync;
  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(join(dir, "walt.sqlite"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL); CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL); PRAGMA user_version=1;",
    );
  }
  load(): State {
    const row = this.db.prepare("SELECT json FROM state WHERE id=1").get() as
      | { json: string }
      | undefined;
    return row
      ? JSON.parse(row.json)
      : {
          revision: 0,
          projects: [],
          rooms: [],
          asks: [],
          engines: [],
          personas: [],
          settings: { locale: "en", theme: "dark", idleMinutes: 15 },
        };
  }
  save(state: State, type = "state.updated") {
    state.revision++;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("INSERT OR REPLACE INTO state VALUES(1,?)")
        .run(JSON.stringify(state));
      this.db
        .prepare("INSERT INTO events(at,type,payload) VALUES(?,?,?)")
        .run(
          new Date().toISOString(),
          type,
          JSON.stringify({ revision: state.revision }),
        );
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
