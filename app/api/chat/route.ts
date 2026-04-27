import { auth } from "@/lib/auth";
import { PERSONAS, buildContextString } from "@/lib/personas";
import { createSupabaseServiceClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { PersonaId } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  // Auth check — no session = 401
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { personaId, userMessage, roomId, history } = await req.json() as {
    personaId: PersonaId;
    userMessage: string;
    roomId: string;
    history: Array<{ role: string; persona?: string; content: string; user_name?: string }>;
  };

  const persona = PERSONAS[personaId];
  if (!persona) {
    return NextResponse.json({ error: "Unknown persona" }, { status: 400 });
  }

  // Verify user is a member of this room
  const supabase = createSupabaseServiceClient();
  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", session.user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });
  }

  // Build context from history
  const context = buildContextString(history);
  const prompt = context
    ? `Here is the full writers room chat log:\n\n${context}\n\n---\n\nThe user just said: "${userMessage}"\n\nRespond as ${persona.name}.`
    : `The user just said: "${userMessage}"\n\nRespond as ${persona.name}.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: persona.system,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // Persist agent message to database
    await supabase.from("messages").insert({
      room_id: roomId,
      role: "agent",
      persona: personaId,
      content: text,
    });

    return NextResponse.json({ text });
  } catch (err) {
    console.error("Anthropic error:", err);
    return NextResponse.json({ error: "Model call failed" }, { status: 500 });
  }
}
