// POST /api/director/brief
// Generates a Director-narrated "while you were away" summary from unseen messages.
// Called when a user returns to a room after 2+ hours of inactivity.

import { assertWriteAllowed, getActorContext, unauthorizedResponse, verifyRoomAccess } from "@/lib/authz";
import { anthropic, DEFAULT_MODEL } from "@/lib/anthropic";
import { checkAndRecordCall, rateLimitResponse } from "@/lib/rateLimit";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

const SYSTEM = `You are the Director in a Writers Room. You are generating a "while you were away" brief — a concise, 2-3 sentence summary of what happened in the room since the user last visited.

Speak directly to the user as "you". Name the agents and collaborators by their handles (@writer, @critic, etc.) or names. Be specific — name what was produced, what was flagged, what needs attention. Flag things that need the user's response with "X things waiting on you." at the end if applicable.

No preamble. No "Here is a summary". Just the narrative, 2-3 sentences max.`;

const MAX_AWAY_DURATION_LEN = 20;
const MAX_MESSAGES = 20;
const MAX_CONTENT_LEN = 120;

export async function POST(req: Request) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  if (actor.mode === "user" && actor.userId) {
    const rl = await checkAndRecordCall(actor.userId);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);
  }

  const body = await req.json();
  const { roomId, awayDuration } = body as { roomId: string; awayDuration: string };

  if (!roomId || typeof roomId !== "string") {
    return NextResponse.json({ error: "roomId required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const canAccess = await verifyRoomAccess(supabase, roomId, actor);
  if (!canAccess) return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });

  // Fetch messages server-side — never trust the client to send them
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("role, persona, content, user_name, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });
  if (!messages?.length) return NextResponse.json({ text: "" });

  // Sanitize awayDuration — client-supplied, used in prompt
  const safeDuration = typeof awayDuration === "string"
    ? awayDuration.replace(/[^\w\s:hm]/g, "").slice(0, MAX_AWAY_DURATION_LEN)
    : "some time";

  // Build a compact representation (oldest-first for the brief)
  const eventLines = [...messages].reverse().map(m => {
    const snippet = String(m.content ?? "").slice(0, MAX_CONTENT_LEN);
    if (m.role === "user") return `User (${m.user_name ?? "you"}): "${snippet}"`;
    return `@${m.persona}: "${snippet}"`;
  }).join("\n");

  const prompt = `The user was away for ${safeDuration}. Here is what happened in the room:\n\n${eventLines}\n\nWrite the Director's 2-3 sentence brief. Flag anything that needs the user's response.`;

  try {
    const message = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 180,
      temperature: 0.6,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
