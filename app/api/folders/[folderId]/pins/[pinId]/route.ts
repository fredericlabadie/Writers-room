import { assertWriteAllowed, getActorContext, unauthorizedResponse } from "@/lib/authz";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

type Params = { params: { folderId: string; pinId: string } };

// DELETE /api/folders/[folderId]/pins/[pinId]
export async function DELETE(req: Request, { params }: Params) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("folder_pins")
    .delete()
    .eq("id", params.pinId)
    .eq("folder_id", params.folderId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
