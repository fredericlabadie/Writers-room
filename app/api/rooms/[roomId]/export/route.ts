import { auth } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

interface Params { params: { roomId: string } }

function slug(name: string) {
  return name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
}

function buildMarkdown(room: any, messages: any[]): string {
  const lines: string[] = [
    `# ${room.name}`,
    room.description ? `\n_${room.description}_` : "",
    `\n**Exported:** ${new Date().toLocaleString()}`,
    `**Room type:** ${room.room_type ?? "writers"}`,
  ];
  if (room.notes?.trim()) {
    lines.push("\n---\n\n## 📝 Room Notes\n");
    lines.push(room.notes.trim());
  }
  lines.push("\n---\n\n## Conversation\n");
  for (const m of messages) {
    const who = m.role === "user"
      ? `**${m.profiles?.name ?? "User"}**`
      : `**@${m.persona ?? "agent"}**`;
    const time = new Date(m.created_at).toLocaleString([], {
      dateStyle: "short",
      timeStyle: "short",
    });
    lines.push(`### ${who} · ${time}\n\n${m.content}\n`);
  }
  return lines.join("\n");
}

async function fetchRoomData(roomId: string, userId: string) {
  const supabase = createSupabaseServiceClient();
  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .single();
  if (!membership) return null;
  const { data: room } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  const { data: messages } = await supabase
    .from("messages")
    .select("*, profiles(name)")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  return { room, messages: messages ?? [] };
}

// GET — .md file download (works for everyone)
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await fetchRoomData(params.roomId, session.user.id);
  if (!result) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const markdown = buildMarkdown(result.room, result.messages);
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug(result.room.name)}-export.md"`,
    },
  });
}

// POST — Google Drive for Google users, .md download fallback
export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const googleToken = (session as any).googleAccessToken as string | undefined;
  const result = await fetchRoomData(params.roomId, session.user.id);
  if (!result) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { room, messages } = result;
  const markdown = buildMarkdown(room, messages);

  if (googleToken) {
    try {
      const boundary = "wr_export_boundary";
      const body = [
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        JSON.stringify({
          name: `${room.name} — Writers Room Export`,
          mimeType: "application/vnd.google-apps.document",
        }),
        `--${boundary}`,
        "Content-Type: text/plain; charset=UTF-8",
        "",
        markdown,
        `--${boundary}--`,
      ].join("\r\n");

      const uploadRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        }
      );

      if (uploadRes.ok) {
        const { id } = await uploadRes.json();
        return NextResponse.json({
          driveUrl: `https://docs.google.com/document/d/${id}/edit`,
        });
      }
      console.error("Drive upload failed:", uploadRes.status);
    } catch (err) {
      console.error("Drive upload exception:", err);
    }
  }

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug(room.name)}-export.md"`,
    },
  });
}
