"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ROOM_TYPE_CONFIG } from "@/lib/personas";
import type { RoomType } from "@/types";

const T = {
  bg:    "#0a0a0c",
  bg2:   "#0e0e11",
  surf:  "#131318",
  surf2: "#1a1a20",
  bdr:   "#23232a",
  bdr2:  "#2e2e36",
  text:  "#e5e5ea",
  body:  "#b8b8c0",
  sub:   "#8a8a92",
  meta:  "#5a5a62",
  faint: "#3a3a42",
  mono:  "'IBM Plex Mono', ui-monospace, monospace",
  sans:  "'IBM Plex Sans', system-ui, sans-serif",
  serif: "'DM Serif Display', 'Source Serif Pro', Georgia, serif",
  italic:"'Source Serif Pro', 'Iowan Old Style', Georgia, serif",
} as const;

const AGENT_COLORS: Record<string, string> = {
  researcher: "#0fe898", intel: "#0fe898", analyst: "#0fe898", reader: "#0fe898",
  writer: "#4da8ff", drafter: "#4da8ff",
  editor: "#ffca00",
  critic: "#ff5a5a",
  director: "#c89cff",
  strategist: "#f97316", coach: "#38bdf8", scheduler: "#5cdaff",
  networker: "#fb7185", navigator: "#34d399", advocate: "#fbbf24",
  planner: "#60a5fa", scout: "#e879f9", pitcher: "#4ade80",
  marketer: "#fb923c",
};
const AGENT_ICONS: Record<string, string> = {
  researcher: "◈", intel: "◐", analyst: "◑", reader: "◫",
  writer: "✦", drafter: "◧",
  editor: "⌘", critic: "⚡", director: "◎",
  strategist: "◉", coach: "◆", scheduler: "⌖",
  networker: "◍", navigator: "◈", advocate: "◎",
  planner: "✦", scout: "◬", pitcher: "⌘", marketer: "◉",
};

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Message rendering (read-only, voice-distinct) ─────────────────────────────

function UserMsg({ msg }: { msg: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", margin: "18px 0" }}>
      <div style={{ maxWidth: "68%" }}>
        <div style={{ background: "#1e1f25", border: `1px solid ${T.bdr2}`, borderRadius: "10px 10px 2px 10px", padding: "12px 16px", fontFamily: T.sans, fontSize: 14, lineHeight: 1.65, color: T.text }}>
          {msg.content}
        </div>
        <div style={{ marginTop: 5, textAlign: "right", fontFamily: T.mono, fontSize: 9, color: T.meta, letterSpacing: "0.06em" }}>
          {msg.user_name ? msg.user_name.toUpperCase() : "YOU"} · {formatDate(msg.created_at)}
        </div>
      </div>
    </div>
  );
}

function AgentMsg({ msg }: { msg: any }) {
  const persona = msg.persona ?? "writer";
  const color = AGENT_COLORS[persona] ?? T.sub;
  const icon = AGENT_ICONS[persona] ?? "◉";
  const isWriter   = ["writer", "drafter"].includes(persona);
  const isResearch = ["researcher", "intel", "analyst", "reader"].includes(persona);
  const isCritic   = persona === "critic";
  const isDirector = persona === "director";

  if (isDirector) {
    return (
      <div style={{ margin: "32px -24px", padding: "22px 40px", background: color + "0f", borderTop: `1px solid ${color}55`, borderBottom: `1px solid ${color}28` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 18, color }}>◎</span>
          <span style={{ fontFamily: T.mono, fontSize: 10, color, letterSpacing: "0.06em" }}>@director</span>
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta, marginLeft: 6 }}>SYNTHESIS</span>
          <div style={{ flex: 1, height: 1, background: color + "16", marginLeft: 8 }} />
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta }}>{formatDate(msg.created_at)}</span>
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 20, lineHeight: 1.65, color: T.text, maxWidth: 640, whiteSpace: "pre-wrap", letterSpacing: "-0.005em" }}>
          {msg.content}
        </div>
      </div>
    );
  }

  if (isWriter) {
    return (
      <div style={{ margin: "28px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 14, color }}>{icon}</span>
          <span style={{ fontFamily: T.mono, fontSize: 9.5, color, letterSpacing: "0.04em" }}>@{persona}</span>
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta, letterSpacing: "0.1em" }}>DRAFT</span>
          <div style={{ flex: 1, height: 1, background: color + "22" }} />
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta }}>{formatDate(msg.created_at)}</span>
        </div>
        <div style={{ position: "relative", padding: "22px 28px 22px 36px", borderLeft: `2px solid ${color}`, background: color + "07" }}>
          <div style={{ position: "absolute", left: 12, top: 22, fontFamily: T.mono, fontSize: 8, color: color + "55", letterSpacing: "0.1em", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>DRAFT</div>
          <div style={{ fontFamily: T.italic, fontSize: 17, lineHeight: 1.9, color: T.text, fontStyle: "italic", whiteSpace: "pre-wrap", letterSpacing: "-0.005em" }}>{msg.content}</div>
        </div>
      </div>
    );
  }

  if (isResearch) {
    return (
      <div style={{ margin: "24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 14, color }}>{icon}</span>
          <span style={{ fontFamily: T.mono, fontSize: 9.5, color, letterSpacing: "0.04em" }}>@{persona}</span>
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta, letterSpacing: "0.1em" }}>RESEARCH NOTE</span>
          <div style={{ flex: 1, height: 1, background: color + "22" }} />
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta }}>{formatDate(msg.created_at)}</span>
        </div>
        <div style={{ border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, background: color + "07", borderRadius: "0 6px 6px 0", padding: "14px 18px" }}>
          <div style={{ fontFamily: T.mono, fontSize: 13, lineHeight: 1.6, color: T.body, whiteSpace: "pre-wrap" }}>{msg.content}</div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${color}22`, fontFamily: T.mono, fontSize: 9, color: color + "88", letterSpacing: "0.1em" }}>SOURCES CITED · FACT-CHECKED</div>
        </div>
      </div>
    );
  }

  if (isCritic) {
    return (
      <div style={{ margin: "24px 0 24px 56px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 14, color }}>{icon}</span>
          <span style={{ fontFamily: T.mono, fontSize: 9.5, color, letterSpacing: "0.04em" }}>@{persona}</span>
          <span style={{ fontFamily: T.mono, fontSize: 8, color: color + "88", letterSpacing: "0.1em" }}>CHALLENGE</span>
          <div style={{ flex: 1, height: 1, background: color + "22" }} />
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta }}>{formatDate(msg.created_at)}</span>
        </div>
        <div style={{ border: `1.5px dashed ${color}66`, borderLeft: `3px solid ${color}`, background: color + "09", borderRadius: "0 4px 4px 0", padding: "14px 20px" }}>
          <div style={{ fontFamily: T.sans, fontSize: 14, lineHeight: 1.75, color: T.body, whiteSpace: "pre-wrap" }}>{msg.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ margin: "24px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14, color }}>{icon}</span>
        <span style={{ fontFamily: T.mono, fontSize: 9.5, color, letterSpacing: "0.04em" }}>@{persona}</span>
        <div style={{ flex: 1, height: 1, background: color + "22" }} />
        <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta }}>{formatDate(msg.created_at)}</span>
      </div>
      <div style={{ borderLeft: `3px solid ${color}`, background: color + "0a", padding: "14px 18px", fontFamily: T.sans, fontSize: 14, lineHeight: 1.75, color: T.body, whiteSpace: "pre-wrap" }}>{msg.content}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReviewLinkPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "expired" | "notfound">("loading");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/r/${token}`)
      .then(async res => {
        if (res.status === 410) { setStatus("expired"); return; }
        if (!res.ok) { setStatus("notfound"); return; }
        const json = await res.json();
        setData(json);
        setStatus("ok");
      })
      .catch(() => setStatus("notfound"));
  }, [token]);

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.mono, fontSize: 11, color: T.meta }}>
        Loading…
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.sans }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ color: "#c89cff", fontSize: 28, marginBottom: 16 }}>◎</div>
          <div style={{ fontFamily: T.serif, fontSize: 22, color: T.text, marginBottom: 10 }}>This link has expired.</div>
          <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.6 }}>Review links are valid for 72 hours. Ask the owner to generate a new one.</div>
        </div>
      </div>
    );
  }

  if (status === "notfound" || !data) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.sans }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontFamily: T.serif, fontSize: 22, color: T.text, marginBottom: 10 }}>Link not found.</div>
          <div style={{ fontSize: 13, color: T.sub }}>This link may have been revoked or never existed.</div>
        </div>
      </div>
    );
  }

  const { room, messages, link, folderName } = data;
  const cfg = ROOM_TYPE_CONFIG[(room.room_type as RoomType) ?? "writers"];
  const expiryStr = timeUntil(link.expiresAt);
  const isExpired = expiryStr === "expired";

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.sans, display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&family=DM+Serif+Display:ital@0;1&family=Source+Serif+Pro:ital,wght@0,400;1,400&display=swap'); *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${T.bdr2}; border-radius: 2px; }`}</style>

      {/* Read-only banner */}
      <div style={{ background: `linear-gradient(180deg, #1a1508 0%, #141208 100%)`, borderBottom: `1px solid #3a2e14`, padding: "11px 28px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#f5b041" }}>◐</span>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: "#f5b041", letterSpacing: "0.12em" }}>READ-ONLY REVIEW</span>
        </div>
        <div style={{ width: 1, height: 14, background: "#3a2e14" }} />
        {link.creatorName && (
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.body }}>
            shared by <span style={{ color: T.text }}>{link.creatorName}</span>
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: T.mono, fontSize: 10, color: isExpired ? "#ff5a5a" : "#f5b041", letterSpacing: "0.06em" }}>
          {isExpired ? "EXPIRED" : `EXPIRES IN ${expiryStr.toUpperCase()}`}
        </span>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.meta }}>·</span>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.meta, letterSpacing: "0.06em" }}>SNAPSHOT {formatDate(link.createdAt).toUpperCase()}</span>
      </div>

      {/* Room header */}
      <div style={{ padding: "22px 32px 18px", borderBottom: `1px solid ${T.bdr}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.meta, letterSpacing: "0.12em" }}>WRITERS ROOM</span>
          {folderName && <>
            <span style={{ color: T.faint }}>/</span>
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.meta, letterSpacing: "0.12em" }}>{folderName.toUpperCase()}</span>
          </>}
          <span style={{ color: T.faint }}>/</span>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.meta, letterSpacing: "0.12em" }}>{room.name.toUpperCase()}</span>
        </div>
        <h1 style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 400, color: T.text, letterSpacing: "-0.01em", marginBottom: 10 }}>
          {room.name}
        </h1>
        {room.description && (
          <p style={{ fontSize: 13, color: T.sub, marginBottom: 10 }}>{room.description}</p>
        )}
        <div style={{ display: "flex", gap: 16, alignItems: "center", fontFamily: T.mono, fontSize: 10, color: T.meta, letterSpacing: "0.04em", flexWrap: "wrap" }}>
          <span>{messages.length} MESSAGES</span>
          <span>·</span>
          <span style={{ color: cfg.color }}>{cfg.icon} {cfg.label.toUpperCase()}</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 32px 60px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", fontFamily: T.mono, fontSize: 11, color: T.meta }}>NO MESSAGES YET</div>
          )}
          {messages.map((msg: any) =>
            msg.role === "user"
              ? <UserMsg key={msg.id} msg={msg} />
              : <AgentMsg key={msg.id} msg={msg} />
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${T.bdr}`, background: T.bg2, padding: "14px 32px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ flex: 1, padding: "9px 14px", background: T.surf, border: `1px dashed ${T.bdr2}`, borderRadius: 6, fontFamily: T.mono, fontSize: 10, color: T.meta, letterSpacing: "0.04em" }}>
          ⊘ &nbsp;READ-ONLY · YOU CANNOT POST IN THIS ROOM
        </div>
        <button
          onClick={() => router.push("/rooms")}
          style={{ background: T.text, color: T.bg, border: "none", fontFamily: T.mono, fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", padding: "9px 16px", borderRadius: 4, cursor: "pointer" }}
        >
          OPEN MY ROOMS →
        </button>
      </div>
    </div>
  );
}
