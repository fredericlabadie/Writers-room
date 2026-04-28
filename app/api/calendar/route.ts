import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export interface CalendarEvent {
  title: string;
  date: string;       // ISO 8601 or natural language — we parse both
  duration: string;   // e.g. "1 hour", "30 minutes", "2 hours"
  notes?: string;
}

// Parse natural language duration to minutes
function parseDurationMinutes(duration: string): number {
  const d = duration.toLowerCase();
  const hours = parseFloat(d.match(/(\d+\.?\d*)\s*h/)?.[1] ?? "0");
  const mins  = parseFloat(d.match(/(\d+\.?\d*)\s*m/)?.[1] ?? "0");
  const total = hours * 60 + mins;
  return total > 0 ? total : 60; // default 1 hour
}

// POST /api/calendar — create a single calendar event
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const googleToken = (session as any).googleAccessToken as string | undefined;
  if (!googleToken) {
    return NextResponse.json(
      { error: "no_calendar_access", message: "Calendar access not granted. Please sign out and sign back in with Google to enable calendar integration." },
      { status: 403 }
    );
  }

  const { event } = await req.json() as { event: CalendarEvent };
  if (!event?.title || !event?.date) {
    return NextResponse.json({ error: "title and date required" }, { status: 400 });
  }

  const durationMins = parseDurationMinutes(event.duration ?? "1 hour");

  // Parse start time — try ISO first, then use current date + time hint
  let startTime: Date;
  try {
    startTime = new Date(event.date);
    if (isNaN(startTime.getTime())) throw new Error("invalid date");
  } catch {
    // Fallback: schedule for 9am tomorrow
    startTime = new Date();
    startTime.setDate(startTime.getDate() + 1);
    startTime.setHours(9, 0, 0, 0);
  }

  const endTime = new Date(startTime.getTime() + durationMins * 60 * 1000);

  const body = {
    summary: event.title,
    description: event.notes ?? "",
    start: { dateTime: startTime.toISOString(), timeZone: "UTC" },
    end:   { dateTime: endTime.toISOString(),   timeZone: "UTC" },
  };

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${googleToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    // Token expired — tell client to re-auth
    if (res.status === 401) {
      return NextResponse.json(
        { error: "token_expired", message: "Calendar token expired. Please sign out and sign back in." },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: err.error?.message ?? "Google Calendar error" }, { status: 500 });
  }

  const created = await res.json();
  return NextResponse.json({
    id: created.id,
    title: created.summary,
    htmlLink: created.htmlLink,
    start: created.start.dateTime,
  });
}
