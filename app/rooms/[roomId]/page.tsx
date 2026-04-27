import { auth } from "@/lib/auth";
import { getReviewSessionFromServerCookies } from "@/lib/review-mode";
import { createSupabaseServiceClient } from "@/lib/supabase";
import WritersRoom from "@/components/WritersRoom";
import { redirect } from "next/navigation";

interface Props {
  params: { roomId: string };
}

export default async function RoomPage({ params }: Props) {
  const session = await auth();
  const review = await getReviewSessionFromServerCookies();
  if (!session?.user?.id && !review?.scope.read) redirect("/login");

  const supabase = createSupabaseServiceClient();

  let room: any = null;
  let userRole: "owner" | "member" = "member";
  if (session?.user?.id) {
    const { data: membership } = await supabase
      .from("room_members")
      .select("role, rooms (id, name, description, is_private, invite_code, owner_id)")
      .eq("room_id", params.roomId)
      .eq("user_id", session.user.id)
      .single();

    if (!membership) redirect("/rooms");
    room = membership.rooms as any;
    userRole = membership.role as "owner" | "member";
  } else {
    const { data } = await supabase
      .from("rooms")
      .select("id, name, description, is_private, invite_code, owner_id")
      .eq("id", params.roomId)
      .single();
    if (!data) redirect("/rooms");
    room = data;
  }

  return (
    <WritersRoom
      room={room}
      currentUser={{
        id: session?.user?.id ?? "reviewer",
        name: session?.user?.name ?? review?.label ?? "AI Reviewer",
        image: session?.user?.image ?? null,
      }}
      userRole={userRole}
      reviewScope={review?.scope ?? null}
    />
  );
}
