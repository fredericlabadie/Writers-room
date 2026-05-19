// POST /api/director/intervene
// Generates a Director-voiced intervention card given a trigger type + context.
// Called client-side when a heuristic fires, not on every turn.

import { assertWriteAllowed, getActorContext, unauthorizedResponse, verifyRoomAccess } from "@/lib/authz";
import { anthropic, DEFAULT_MODEL } from "@/lib/anthropic";
import { checkAndRecordCall, rateLimitResponse } from "@/lib/rateLimit";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

const SYSTEM = `You are the Director in a Writers Room — a synthesizing agent who keeps the conversation on track.
You are generating a short intervention card, not a full reply. Speak in first person as the Director.
Be brief, specific, and offer exactly one concrete path forward. Sound like a thoughtful collaborator, not a chatbot.
No preamble. No "I noticed that...". Just the observation and the offer.
Respond with only the intervention text — 1-3 sentences maximum.`;

// Sanitize a client-supplied string: strip to plain text, cap length
function sanitize(value: unknown, maxLen: number): string {
  return String(value ?? "").replace(/[\x00-\x1f]/g, " ").slice(0, maxLen);
}

const PROMPTS: Record<string, (ctx: any) => string> = {
  hedge_word: (ctx) => {
    const hedgeWord = sanitize(ctx.hedgeWord, 30);
    const count = Math.max(0, Math.min(99, Number(ctx.count) || 0));
    const triggerText = sanitize(ctx.triggerText, 200);
    return `The writer just used "${hedgeWord}" ${count} times in one passage: "${triggerText}". Write a 1-2 sentence Director intervention offering to pin a direction like "no hedge-words: just, only, really" to prevent this recurring.`;
  },

  thread_drift: (ctx) => {
    const turnCount = Math.max(0, Math.min(999, Number(ctx.turnCount) || 0));
    const recentSummary = sanitize(ctx.recentSummary, 300);
    return `We're ${turnCount} turns in. The recent messages cover: ${recentSummary}. Write a 2-3 sentence Director structural check-in that names the drift and asks what the spine of this section is. End with a concrete offer.`;
  },

  pattern_working: (ctx) => {
    const agentId = sanitize(ctx.agentId, 30);
    const criticText = sanitize(ctx.criticText, 200);
    return `The critic just said something positive about the ${agentId}'s work: "${criticText}". Write a 1-2 sentence Director note that names the pattern and offers to pin it as a direction so it repeats.`;
  },
};

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
  const { roomId, type, context } = body as { roomId: string; type: string; context: any };

  if (!roomId || typeof roomId !== "string") {
    return NextResponse.json({ error: "roomId required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const canAccess = await verifyRoomAccess(supabase, roomId, actor);
  if (!canAccess) return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });

  const promptFn = PROMPTS[type];
  if (!promptFn) return NextResponse.json({ error: "Unknown intervention type" }, { status: 400 });

  try {
    const message = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 150,
      temperature: 0.7,
      system: SYSTEM,
      messages: [{ role: "user", content: promptFn(context) }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
