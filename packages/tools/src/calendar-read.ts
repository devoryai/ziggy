/**
 * calendar.read tool wrapper
 *
 * Currently uses a mock provider for demo/MVP.
 * TODO: Replace with real Google Calendar / CalDAV provider.
 */
import { CalendarReadArgsSchema } from "@ziggy/shared";
import { checkToolScope } from "@ziggy/policy";
import type { ToolCallResult } from "@ziggy/shared";
import type { ToolHandler } from "./types";

// ---- Provider interface ----

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees?: string[];
  location?: string;
  description?: string;
  isAllDay?: boolean;
}

export interface CalendarProvider {
  listEvents(calendar: string, date: string): Promise<CalendarEvent[]>;
}

// ---- Mock provider ----

function todayAt(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: "evt-001",
    title: "Engineering standup",
    start: todayAt(9, 30),
    end: todayAt(9, 45),
    attendees: ["team@example.com"],
    description: "Daily standup. Quick wins and blockers.",
  },
  {
    id: "evt-002",
    title: "Q2 planning review",
    start: todayAt(11, 0),
    end: todayAt(12, 0),
    attendees: [
      "sarah.chen@example.com",
      "alex.kim@example.com",
      "me@example.com",
    ],
    location: "Conf Room B / Zoom",
    description:
      "Review Q2 plan draft. Sarah is driving. Come prepared to comment on API migration timeline and mobile team scope.",
  },
  {
    id: "evt-003",
    title: "Lunch with design team",
    start: todayAt(12, 30),
    end: todayAt(13, 30),
    location: "Rooftop patio",
    description: "Informal — no agenda.",
  },
  {
    id: "evt-004",
    title: "1:1 with manager",
    start: todayAt(15, 0),
    end: todayAt(15, 30),
    attendees: ["manager@example.com", "me@example.com"],
    description:
      "Weekly 1:1. Topics this week: career development discussion, feedback on Q1 projects.",
  },
];

export class MockCalendarProvider implements CalendarProvider {
  async listEvents(_calendar: string, _date: string): Promise<CalendarEvent[]> {
    await new Promise((r) => setTimeout(r, 40));
    return MOCK_EVENTS;
  }
}

// ---- Tool handler ----

let activeProvider: CalendarProvider = new MockCalendarProvider();

export function setCalendarProvider(provider: CalendarProvider): void {
  activeProvider = provider;
}

export const calendarReadTool: ToolHandler = {
  capabilityId: "calendar.read",

  async execute(args, _runId): Promise<ToolCallResult> {
    const parsed = CalendarReadArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, error: `Invalid args: ${parsed.error.message}` };
    }

    const violations = checkToolScope("calendar.read", parsed.data as Record<string, unknown>);
    if (violations.length > 0) {
      return { success: false, error: violations.join("; ") };
    }

    try {
      const date = parsed.data.date ?? new Date().toISOString().slice(0, 10);
      const events = await activeProvider.listEvents(parsed.data.calendar, date);

      // Build prep notes for each event that has attendees
      const prepNotes = events
        .filter((e) => e.attendees && e.attendees.length > 0)
        .map((e) => ({
          eventId: e.id,
          title: e.title,
          start: e.start,
          prepNote: buildPrepNote(e),
        }));

      return {
        success: true,
        data: {
          date,
          calendar: parsed.data.calendar,
          eventCount: events.length,
          events,
          prepNotes,
        },
      };
    } catch (err) {
      return { success: false, error: `calendar.read failed: ${String(err)}` };
    }
  },
};

function buildPrepNote(event: CalendarEvent): string {
  const parts: string[] = [];
  if (event.description) {
    parts.push(`Context: ${event.description}`);
  }
  if (event.attendees && event.attendees.length > 1) {
    parts.push(`Attendees: ${event.attendees.join(", ")}`);
  }
  if (event.location) {
    parts.push(`Location: ${event.location}`);
  }
  parts.push("Suggested: Review any recent threads with attendees. Note open questions.");
  return parts.join("\n");
}
