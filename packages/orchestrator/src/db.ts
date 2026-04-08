/**
 * Database connection for the orchestrator.
 * Uses the built-in node:sqlite module (Node 22.5+).
 */
import { DatabaseSync } from "node:sqlite";
import { resolve, dirname } from "path";
import { mkdirSync } from "fs";

export function getDbPath(): string {
  return process.env.ZIGGY_DB_PATH ?? resolve(process.cwd(), "data/ziggy.db");
}

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_db) {
    const dbPath = getDbPath();
    mkdirSync(dirname(dbPath), { recursive: true });
    _db = new DatabaseSync(dbPath);
    _db.exec("PRAGMA journal_mode = WAL");
    _db.exec("PRAGMA foreign_keys = ON");
  }
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
