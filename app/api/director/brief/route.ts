// POST /api/director/brief
// Generates a Director-narrated "while you were away" summary from unseen messages.
// Called when a user returns to a room after 2+ hours of inactivity.

import { assertWriteAllowed, getActorContext, unauthorizedResponse } from "@/lib/authz";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are the Director in a Writers Room. You are generating a "while you were away" brief — a concise, 2-3 sentence summary of what happened in the room since the user last visited.

Speak directly to the user as "you". Name the agents and collaborators by their handles (@writer, @critic, etc.) or names. Be specific — name what was produced, what was flagged, what needs attention. Flag things that need the user's response with "X things waiting on you." at the end if applicable.

No preamble. No "Here is a summary". Just the narrative, 2-3 sentences max.`;

export async function POST(req: Request) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const { messages, awayDuration } = await req.json() as {
    messages: Array<{ role: string; persona?: string; content: string; user_name?: string; created_at: string }>;
    awayDuration: string; // e.g. "14h 22m"
  };

  if (!messages?.length) return NextResponse.json({ text: "" });

  // Build a compact representation of what happened
  const eventLines = messages.slice(0, 20).map(m => {
    if (m.role === "user") return `User (${m.user_name ?? "you"}): "${m.content.slice(0, 80)}"`;
    return `@${m.persona}: "${m.content.slice(0, 120)}"`;
  }).join("\n");

  const prompt = `The user was away for ${awayDuration}. Here is what happened in the room:\n\n${eventLines}\n\nWrite the Director's 2-3 sentence brief. Flag anything that needs the user's response.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
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
