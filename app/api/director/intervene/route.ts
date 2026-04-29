// POST /api/director/intervene
// Generates a Director-voiced intervention card given a trigger type + context.
// Called client-side when a heuristic fires, not on every turn.

import { assertWriteAllowed, getActorContext, unauthorizedResponse } from "@/lib/authz";
import { createSupabaseServiceClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are the Director in a Writers Room — a synthesizing agent who keeps the conversation on track.
You are generating a short intervention card, not a full reply. Speak in first person as the Director.
Be brief, specific, and offer exactly one concrete path forward. Sound like a thoughtful collaborator, not a chatbot.
No preamble. No "I noticed that...". Just the observation and the offer.
Respond with only the intervention text — 1-3 sentences maximum.`;

const PROMPTS: Record<string, (ctx: any) => string> = {
  hedge_word: ({ triggerText, hedgeWord, count }) =>
    `The writer just used "${hedgeWord}" ${count} times in one passage: "${triggerText.slice(0, 200)}". Write a 1-2 sentence Director intervention offering to pin a direction like "no hedge-words: just, only, really" to prevent this recurring.`,
  
  thread_drift: ({ turnCount, recentSummary }) =>
    `We're ${turnCount} turns in. The recent messages cover: ${recentSummary}. Write a 2-3 sentence Director structural check-in that names the drift and asks what the spine of this section is. End with a concrete offer.`,
  
  pattern_working: ({ criticText, agentId }) =>
    `The critic just said something positive about the ${agentId}'s work: "${criticText.slice(0, 200)}". Write a 1-2 sentence Director note that names the pattern and offers to pin it as a direction so it repeats.`,
};

export async function POST(req: Request) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const body = await req.json();
  const { type, context } = body as { type: string; context: any };

  const promptFn = PROMPTS[type];
  if (!promptFn) return NextResponse.json({ error: "Unknown intervention type" }, { status: 400 });

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
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
