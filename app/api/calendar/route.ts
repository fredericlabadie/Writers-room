import { auth } from "@/lib/auth";
import { createCalendarEvent } from "@/lib/googleCalendar";
import { NextResponse } from "next/server";

export interface CalendarEventInput {
  title: string;
  date?: string;      // ISO 8601 or omitted
  duration: string;   // "1 hour", "30 minutes", etc.
  notes?: string;
}

function parseDurationMinutes(duration: string): number {
  const d = duration.toLowerCase();
  const hours = parseFloat(d.match(/(\d+\.?\d*)\s*h/)?.[1] ?? "0");
  const mins  = parseFloat(d.match(/(\d+\.?\d*)\s*m/)?.[1] ?? "0");
  const total = hours * 60 + mins;
  return total > 0 ? total : 60;
}

function parseStartTime(date?: string): Date {
  if (!date) {
    // No date given — default to 9am tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  }
  const parsed = new Date(date);
  if (!isNaN(parsed.getTime())) return parsed;
  // Fallback
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(9, 0, 0, 0);
  return fallback;
}

// POST /api/calendar — create a calendar event (create-only)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken  = (session as any).googleAccessToken as string | undefined;
  const refreshToken = (session as any).googleRefreshToken as string | undefined;
  const expiresAt    = (session as any).googleTokenExpiry as number | undefined;

  if (!accessToken) {
    return NextResponse.json(
      {
        error: "no_calendar_access",
        message: "Calendar access not granted. Please sign out and sign back in with Google to enable calendar integration.",
      },
      { status: 403 }
    );
  }

  const { event } = await req.json() as { event: CalendarEventInput };
  if (!event?.title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const startTime = parseStartTime(event.date);
  const durationMins = parseDurationMinutes(event.duration ?? "1 hour");
  const endTime = new Date(startTime.getTime() + durationMins * 60 * 1000);

  try {
    const { event: created } = await createCalendarEvent(
      { accessToken, refreshToken, expiresAt },
      {
        title:       event.title,
        startTime:   startTime.toISOString(),
        endTime:     endTime.toISOString(),
        description: event.notes,
      }
    );

    return NextResponse.json({
      id:       created.id,
      title:    created.summary,
      htmlLink: created.htmlLink,
      start:    (created.start as any)?.dateTime,
    });
  } catch (err: any) {
    if (err.message === "token_revoked") {
      return NextResponse.json(
        {
          error: "token_revoked",
          message: "Calendar access was revoked. Please sign out and sign back in with Google.",
        },
        { status: 401 }
      );
    }
    if (err.message === "no_refresh_token") {
      return NextResponse.json(
        {
          error: "no_calendar_access",
          message: "Calendar access not granted. Please sign out and sign back in with Google.",
        },
        { status: 403 }
      );
    }
    console.error("Calendar error:", err.message);
    return NextResponse.json(
      { error: "calendar_error", message: err.message },
      { status: 500 }
    );
  }
}
