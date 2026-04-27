import { auth } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

// GET /api/messages?roomId=xxx — load history
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId");
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  const supabase = createSupabaseServiceClient();

  // Verify membership
  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", session.user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("messages")
    .select(`*, profiles (name, avatar_url)`)
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/messages — save a user message
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId, content } = await req.json();
  if (!roomId || !content) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("messages")
    .insert({ room_id: roomId, role: "user", user_id: session.user.id, content })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
