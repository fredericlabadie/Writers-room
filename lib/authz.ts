import { auth } from "@/lib/auth";
import { getReviewSessionFromRequest, type ReviewSession } from "@/lib/review-mode";
import { NextResponse } from "next/server";

export interface ActorContext {
  mode: "user" | "review";
  userId: string | null;
  review: ReviewSession | null;
}

export async function getActorContext(req: Request): Promise<ActorContext | null> {
  const session = await auth();
  if (session?.user?.id) {
    return {
      mode: "user",
      userId: session.user.id,
      review: null,
    };
  }

  const review = await getReviewSessionFromRequest(req);
  if (!review?.scope.read) return null;

  return {
    mode: "review",
    userId: null,
    review,
  };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function isWriteAllowed(actor: ActorContext) {
  if (actor.mode === "user") return true;
  return !!actor.review?.scope.write;
}

export function assertWriteAllowed(actor: ActorContext) {
  if (isWriteAllowed(actor)) return null;
  return NextResponse.json({ error: "Review mode is read-only for this token" }, { status: 403 });
}

export async function verifyRoomAccess(supabase: any, roomId: string, actor: ActorContext) {
  if (actor.mode === "review") {
    const { data: room } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", roomId)
      .single();
    return !!room;
  }

  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", actor.userId)
    .single();

  return !!membership;
}
