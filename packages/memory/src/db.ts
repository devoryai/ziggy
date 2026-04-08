/**
 * Database connection for the memory package.
 * Shares the same SQLite file as the orchestrator.
 * Uses the built-in node:sqlite module (Node 22.5+).
 */
import { DatabaseSync } from "node:sqlite";
import { resolve } from "path";

function getDbPath(): string {
  return process.env.ZIGGY_DB_PATH ?? resolve(process.cwd(), "../../data/ziggy.db");
}

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(getDbPath());
    _db.exec("PRAGMA journal_mode = WAL");
    _db.exec("PRAGMA foreign_keys = ON");
  }
  return _db;
}
