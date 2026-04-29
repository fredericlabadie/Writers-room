// POST /api/rooms/[roomId]/onboard
// Generates the Director opening + per-agent self-introductions + first question.
// Called once during onboarding after the user sets the stage.
// Saves messages to DB and returns them.

import { assertWriteAllowed, getActorContext, unauthorizedResponse, verifyRoomAccess } from "@/lib/authz";
import { getAgentsForRoom } from "@/lib/personas";
import { createSupabaseServiceClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Params = { params: { roomId: string } };

export async function POST(req: Request, { params }: Params) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const supabase = createSupabaseServiceClient();
  const canAccess = await verifyRoomAccess(supabase, params.roomId, actor);
  if (!canAccess) return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });

  // Check room isn't already populated
  const { data: existing } = await supabase
    .from("messages").select("id").eq("room_id", params.roomId).limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Room already has messages" }, { status: 409 });
  }

  const { about, reader, tone, roomType, roomName } = await req.json();

  // Fetch room for type
  const { data: room } = await supabase
    .from("rooms").select("id, room_type, name").eq("id", params.roomId).single();
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  // Update room description with the stage data
  const description = [about, reader && `Reader: ${reader}`, tone && `Tone: ${tone}`].filter(Boolean).join(" · ");
  await supabase.from("rooms").update({ description }).eq("id", params.roomId);

  const agents = getAgentsForRoom(roomType ?? room.room_type ?? "writers");
  const agentList = agents.filter(a => a.id !== "director")
    .map(a => `@${a.id} (${a.role}): ${a.tagline}`).join("\n");

  const SYSTEM = `You are the Director in a Writers Room — a synthesizing meta-agent who orchestrates the cast.
You are generating the opening sequence for a new room. Be specific, warm, and voice-distinct.
Respond ONLY with a valid JSON object. No markdown fences, no commentary.`;

  const prompt = `The user has set the stage for their room "${roomName ?? room.name}":
- About: ${about || "(not specified)"}
- Reader / references: ${reader || "(not specified)"}
- Tone: ${tone || "(not specified)"}

The cast for this room:
${agentList}

Generate this JSON:
{
  "director_opening": "A 2-sentence Director message that briefly confirms the stage and introduces the cast. Specific to the project.",
  "agent_intros": [
    ${agents.filter(a => a.id !== "director").map(a => `{"persona": "${a.id}", "text": "One sentence self-intro from @${a.id}. Voice-distinct. Specific to the project."}`).join(",\n    ")}
  ],
  "director_question": "One sharp, specific first question from the Director that opens the work. Not generic."
}`;

  let parsed: any;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      temperature: 0.8,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    parsed = JSON.parse(raw.replace(/```json\n?|```/g, "").trim());
  } catch (e: any) {
    return NextResponse.json({ error: "Generation failed: " + e.message }, { status: 500 });
  }

  // Save messages to DB
  const now = new Date();
  const messagesToInsert = [
    {
      room_id: params.roomId,
      role: "agent",
      persona: "director",
      content: parsed.director_opening,
      created_at: new Date(now.getTime() + 0).toISOString(),
    },
    ...parsed.agent_intros.map((intro: any, i: number) => ({
      room_id: params.roomId,
      role: "agent",
      persona: intro.persona,
      content: intro.text,
      created_at: new Date(now.getTime() + (i + 1) * 500).toISOString(),
    })),
    {
      room_id: params.roomId,
      role: "agent",
      persona: "director",
      content: parsed.director_question,
      created_at: new Date(now.getTime() + (parsed.agent_intros.length + 1) * 500).toISOString(),
    },
  ];

  const { data: saved, error } = await supabase
    .from("messages").insert(messagesToInsert).select("id, role, persona, content, created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ messages: saved, directorQuestion: parsed.director_question });
}
