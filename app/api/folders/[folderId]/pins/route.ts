import { assertWriteAllowed, getActorContext, unauthorizedResponse } from "@/lib/authz";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

type Params = { params: { folderId: string } };

// GET /api/folders/[folderId]/pins
export async function GET(req: Request, { params }: Params) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("folder_pins")
    .select("*")
    .eq("folder_id", params.folderId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/folders/[folderId]/pins — add a pin
export async function POST(req: Request, { params }: Params) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Text required" }, { status: 400 });

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("folder_pins")
    .insert({ folder_id: params.folderId, text: text.trim(), created_by: actor.userId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
