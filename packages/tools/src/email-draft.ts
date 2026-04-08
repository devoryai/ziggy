/**
 * email.draft tool wrapper
 *
 * Creates draft artifacts (stored internally).
 * Does NOT send email in MVP.
 * TODO: Add real Gmail draft API integration behind DraftProvider interface.
 */
import { EmailDraftArgsSchema } from "@ziggy/shared";
import { checkToolScope, loadPreferences } from "@ziggy/policy";
import type { ToolCallResult } from "@ziggy/shared";
import type { ToolHandler } from "./types";

// ---- Provider interface ----

export interface DraftProvider {
  createDraft(
    account: string,
    messageId: string,
    subject: string,
    body: string,
    replyTo?: string
  ): Promise<{ draftId: string }>;
}

// ---- Mock provider ----

export class MockDraftProvider implements DraftProvider {
  async createDraft(
    _account: string,
    _messageId: string,
    subject: string,
    body: string
  ): Promise<{ draftId: string }> {
    await new Promise((r) => setTimeout(r, 30));
    return { draftId: `draft-${Date.now()}` };
  }
}

// ---- Draft generation ----

/**
 * Build a context-aware draft prompt.
 * In real integration, this would pass the thread body to the model.
 * For MVP, generates a sensible placeholder draft.
 */
export function buildDraftContent(
  subject: string,
  originalBody: string,
  contextId: string,
  instructions?: string
): string {
  const prefs = loadPreferences();
  const emailPrefs = prefs.communication?.work_email;

  const avoidList =
    emailPrefs?.avoid_phrases?.map((p) => `"${p}"`).join(", ") ?? "none";

  const tone = emailPrefs?.tone ?? "professional";

  // Generate a mock draft — real model call would go here
  const opening = emailPrefs?.prefers_short_openings ? "" : "Hope this finds you well.\n\n";

  let body = `${opening}Thanks for reaching out regarding: ${subject}\n\n`;

  if (instructions) {
    body += `[Draft note: ${instructions}]\n\n`;
  }

  body += `I'll take a look and follow up shortly.\n\n`;
  body += `[TODO: This is a generated draft — edit before sending]\n`;

  // Append tone/avoidance note for the human editor
  body += `\n---\nDraft context: ${contextId} | Tone: ${tone} | Phrases to avoid: ${avoidList}`;
  body += `\nOriginal message snippet: "${originalBody.slice(0, 100)}..."`;

  return body;
}

// ---- Tool handler ----

let activeProvider: DraftProvider = new MockDraftProvider();

export function setDraftProvider(provider: DraftProvider): void {
  activeProvider = provider;
}

export const emailDraftTool: ToolHandler = {
  capabilityId: "email.draft",

  async execute(args, _runId): Promise<ToolCallResult> {
    // 1. Validate args
    const parsed = EmailDraftArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, error: `Invalid args: ${parsed.error.message}` };
    }

    // email.draft doesn't have an account in args by default — use "work" from policy
    const scopeArgs = { ...parsed.data, account: "work" };
    const violations = checkToolScope("email.draft", scopeArgs as Record<string, unknown>);
    if (violations.length > 0) {
      return { success: false, error: violations.join("; ") };
    }

    try {
      const subject = parsed.data.subject ?? `Re: (message ${parsed.data.message_id})`;
      const draftBody = buildDraftContent(
        subject,
        parsed.data.reply_to ?? "(original message not provided)",
        parsed.data.context,
        parsed.data.instructions
      );

      // For MVP — store as internal draft artifact, don't create real Gmail draft yet
      const draft = {
        draftId: `draft-${Date.now()}`,
        messageId: parsed.data.message_id,
        subject,
        body: draftBody,
        context: parsed.data.context,
        createdAt: new Date().toISOString(),
        status: "draft" as const,
        // Note: not sent — requires human review
      };

      return {
        success: true,
        data: {
          draft,
          note: "Draft created as internal artifact. Not sent. Review and approve before any further action.",
        },
      };
    } catch (err) {
      return { success: false, error: `email.draft failed: ${String(err)}` };
    }
  },
};
