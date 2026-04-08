/**
 * Preference access layer.
 *
 * Loads from preferences.yaml (source of truth).
 * Future: merge with learned signals from draft_diffs.
 */
import { loadPreferences } from "@ziggy/policy";
import { listLearningSignals } from "./draft-diffs";
import type { PreferenceProfile, ContextId } from "@ziggy/shared";

export function getPreferences(): PreferenceProfile {
  return loadPreferences();
}

/**
 * Build an augmented preference summary for a given context,
 * incorporating accumulated learning signals.
 *
 * Returns a plain-text summary suitable for injecting into planner prompts.
 */
export function buildPreferenceSummary(context: ContextId): string {
  const prefs = loadPreferences();
  const signals = listLearningSignals(context);

  const lines: string[] = [];

  if (context === "work_email") {
    const ep = prefs.communication?.work_email;
    if (ep) {
      lines.push(`Tone: ${ep.tone}`);
      if (ep.avoid_phrases?.length) {
        lines.push(`Avoid phrases: ${ep.avoid_phrases.join(", ")}`);
      }
      if (ep.prefers_short_openings) lines.push("Prefers short openings");
    }
  }

  if (signals.length > 0) {
    lines.push("Learned from past edits:");
    for (const s of signals.slice(0, 5)) {
      lines.push(`  - ${s.detail}`);
    }
  }

  return lines.join("\n") || "No preferences configured";
}
