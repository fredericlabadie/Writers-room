import { auth } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import WritersRoom from "@/components/WritersRoom";
import { redirect } from "next/navigation";

interface Props {
  params: { roomId: string };
}

export default async function RoomPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const supabase = createSupabaseServiceClient();

  // Verify membership and load room
  const { data: membership } = await supabase
    .from("room_members")
    .select("role, rooms (id, name, description, is_private, invite_code, owner_id)")
    .eq("room_id", params.roomId)
    .eq("user_id", session.user.id)
    .single();

  if (!membership) redirect("/rooms");

  const room = membership.rooms as any;

  return (
    <WritersRoom
      room={room}
      currentUser={{
        id: session.user.id!,
        name: session.user.name ?? "Anonymous",
        image: session.user.image ?? null,
      }}
      userRole={membership.role as "owner" | "member"}
    />
  );
}
