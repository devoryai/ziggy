/**
 * email.read tool wrapper
 *
 * Currently uses a mock provider for demo/MVP.
 * TODO: Replace MockEmailProvider with a real Gmail/IMAP provider.
 * Provider interface is defined below — attach a real provider by implementing it.
 */
import { EmailReadArgsSchema } from "@ziggy/shared";
import { checkToolScope } from "@ziggy/policy";
import type { ToolCallResult } from "@ziggy/shared";
import type { ToolHandler } from "./types";

// ---- Provider interface ----

export interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  threadId?: string;
}

export interface EmailProvider {
  listUnread(account: string, filter?: string, limit?: number): Promise<EmailMessage[]>;
}

// ---- Mock provider (demo data) ----

const MOCK_EMAILS: EmailMessage[] = [
  {
    id: "msg-001",
    from: "sarah.chen@example.com",
    subject: "Q2 planning — can you review before Thursday?",
    date: new Date().toISOString(),
    snippet: "Hi, wanted to get your eyes on the Q2 plan before we finalize.",
    body: `Hi,

Wanted to get your eyes on the Q2 plan before we finalize on Thursday.
Attached is the draft. Main questions:
1. Does the timeline for the API migration look realistic?
2. Should we keep the mobile team in scope for this quarter?

Let me know if you have concerns or want to sync before the review.

— Sarah`,
    threadId: "thread-001",
  },
  {
    id: "msg-002",
    from: "alex.kim@example.com",
    subject: "Re: onboarding doc update",
    date: new Date(Date.now() - 3600_000).toISOString(),
    snippet: "Thanks for the edits. Quick question on the new dev environment section.",
    body: `Thanks for the edits, really cleaned it up.

Quick question on the new dev environment section —
should we link directly to the internal wiki or keep it self-contained in the doc?

Either works for me but want to make sure it matches what the team prefers.

— Alex`,
    threadId: "thread-002",
  },
  {
    id: "msg-003",
    from: "team-updates@example.com",
    subject: "Weekly team digest — Apr 7",
    date: new Date(Date.now() - 7200_000).toISOString(),
    snippet: "This week: deployment went smoothly, docs sprint starts Monday.",
    body: `Team digest for the week of Apr 7:

- Deployment went smoothly. No incidents.
- Docs sprint starts Monday — see the board for assignments.
- Reminder: 1:1s this week are shifted to Thursday due to the offsite.

More in the full digest linked below.`,
    threadId: "thread-003",
  },
];

export class MockEmailProvider implements EmailProvider {
  async listUnread(
    _account: string,
    _filter?: string,
    limit = 10
  ): Promise<EmailMessage[]> {
    // Simulate a small delay
    await new Promise((r) => setTimeout(r, 50));
    return MOCK_EMAILS.slice(0, limit);
  }
}

// ---- Tool handler ----

// Active provider — swap this for a real implementation
let activeProvider: EmailProvider = new MockEmailProvider();

/** Replace the email provider (e.g., for real Gmail integration). */
export function setEmailProvider(provider: EmailProvider): void {
  activeProvider = provider;
}

export const emailReadTool: ToolHandler = {
  capabilityId: "email.read",

  async execute(args, _runId): Promise<ToolCallResult> {
    // 1. Validate args
    const parsed = EmailReadArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, error: `Invalid args: ${parsed.error.message}` };
    }

    // 2. Policy scope check
    const violations = checkToolScope("email.read", parsed.data as Record<string, unknown>);
    if (violations.length > 0) {
      return { success: false, error: violations.join("; ") };
    }

    // 3. Execute via provider
    try {
      const messages = await activeProvider.listUnread(
        parsed.data.account,
        parsed.data.filter,
        parsed.data.limit
      );
      return {
        success: true,
        data: {
          account: parsed.data.account,
          count: messages.length,
          messages: messages.map((m) => ({
            id: m.id,
            from: m.from,
            subject: m.subject,
            date: m.date,
            snippet: m.snippet,
            // Include full body for drafting use
            body: m.body,
          })),
        },
      };
    } catch (err) {
      return { success: false, error: `email.read failed: ${String(err)}` };
    }
  },
};
