// GET /api/search?q=QUERY&roomId=CURRENT_ROOM_ID
// Returns message results grouped: current room, other rooms
// Used by ⌘K search in WritersRoom.tsx

import { getActorContext, unauthorizedResponse } from "@/lib/authz";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

const MAX_RESULTS_PER_GROUP = 6;
const SNIPPET_LENGTH = 160;

function snippet(text: string, query: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, SNIPPET_LENGTH) + (text.length > SNIPPET_LENGTH ? "…" : "");
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 100);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export async function GET(req: Request) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  if (!actor.userId) return NextResponse.json({ thisRoom: [], otherRooms: [] });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const currentRoomId = url.searchParams.get("roomId") ?? "";

  if (q.length < 2) return NextResponse.json({ thisRoom: [], otherRooms: [] });

  const supabase = createSupabaseServiceClient();

  const { data: memberships } = await supabase
    .from("room_members")
    .select("room_id")
    .eq("user_id", actor.userId);

  const roomIds = (memberships ?? []).map((m: any) => m.room_id as string);
  if (!roomIds.length) return NextResponse.json({ thisRoom: [], otherRooms: [] });

  const { data: messages } = await supabase
    .from("messages")
    .select("id, room_id, role, persona, content, created_at, user_name")
    .in("room_id", roomIds)
    .ilike("content", `%${q}%`)
    .order("created_at", { ascending: false })
    .limit(40);

  if (!messages?.length) return NextResponse.json({ thisRoom: [], otherRooms: [] });

  const otherRoomIds = [...new Set(messages.filter(m => m.room_id !== currentRoomId).map(m => m.room_id))];
  let roomNames: Record<string, string> = {};
  if (otherRoomIds.length) {
    const { data: rooms } = await supabase
      .from("rooms").select("id, name").in("id", otherRoomIds);
    roomNames = Object.fromEntries((rooms ?? []).map((r: any) => [r.id, r.name]));
  }

  const thisRoom = messages
    .filter(m => m.room_id === currentRoomId)
    .slice(0, MAX_RESULTS_PER_GROUP)
    .map(m => ({ ...m, snippet: snippet(m.content, q), roomName: null }));

  const otherRooms = messages
    .filter(m => m.room_id !== currentRoomId)
    .slice(0, MAX_RESULTS_PER_GROUP)
    .map(m => ({ ...m, snippet: snippet(m.content, q), roomName: roomNames[m.room_id] ?? "Unknown room" }));

  return NextResponse.json({ thisRoom, otherRooms });
}
