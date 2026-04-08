/**
 * Database bootstrap for the web app.
 * Ensures schema is initialized once on first API call.
 */
import { initSchema } from "@ziggy/orchestrator";

let initialized = false;

export function ensureDb(): void {
  if (!initialized) {
    initSchema();
    initialized = true;
  }
}
