"use client";

import { useEffect, useState } from "react";
import type { Message } from "@/types";

const T = {
  bg: "#0a0a0c", surf: "#131318", bdr: "#23232a", bdr2: "#2e2e36",
  text: "#e5e5ea", body: "#b8b8c0", sub: "#8a8a92", meta: "#5a5a62", faint: "#3a3a42",
  mono: "'IBM Plex Mono', monospace",
  sans: "'IBM Plex Sans', sans-serif",
  serif: "'DM Serif Display', Georgia, serif",
  italic: "'Source Serif Pro', Georgia, serif",
};

const AGENT_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  researcher: { color: "#0fe898", icon: "◈", label: "Researcher" },
  writer:     { color: "#4da8ff", icon: "✦", label: "Writer" },
  editor:     { color: "#ffca00", icon: "⌘", label: "Editor" },
  critic:     { color: "#ff5a5a", icon: "⚡", label: "Critic" },
  director:   { color: "#c89cff", icon: "◎", label: "Director" },
  scheduler:  { color: "#5cdaff", icon: "◷", label: "Scheduler" },
  strategist: { color: "#ff9f5a", icon: "◉", label: "Strategist" },
  coach:      { color: "#7df5b3", icon: "◆", label: "Coach" },
  drafter:    { color: "#4da8ff", icon: "◧", label: "Drafter" },
  reader:     { color: "#c89cff", icon: "◫", label: "Reader" },
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function expiryLabel(exp: number) {
  const remaining = exp * 1000 - Date.now();
  if (remaining <= 0) return "expired";
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

// Voice-distinct message bubble
function MessageBubble({ msg }: { msg: Message }) {
  const cfg = msg.persona ? AGENT_CONFIG[msg.persona] : null;

  if (msg.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div style={{ maxWidth: "72%", background: "#0d2240", border: "1px solid #4da8ff22", borderRadius: "12px 12px 2px 12px", padding: "10px 14px" }}>
          {msg.user_name && (
            <div style={{ fontFamily: T.mono, fontSize: 9, color: "#4da8ff88", letterSpacing: "0.1em", marginBottom: 5 }}>
              {msg.user_name}
            </div>
          )}
          <div style={{ fontFamily: T.sans, fontSize: 14, color: T.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {msg.content}
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.faint, marginTop: 5, textAlign: "right" }}>
            {timeAgo(msg.created_at)}
          </div>
        </div>
      </div>
    );
  }

  if (!cfg) return null; // skip system messages

  const isDirector = msg.persona === "director";
  const isWriter = msg.persona === "writer" || msg.persona === "drafter";
  const isResearcher = msg.persona === "researcher";

  return (
    <div style={{ marginBottom: 16, borderLeft: `2px solid ${cfg.color}`, paddingLeft: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color: cfg.color, fontSize: 13 }}>{cfg.icon}</span>
        <span style={{ fontFamily: T.mono, fontSize: 9, color: cfg.color, letterSpacing: "0.1em" }}>
          @{msg.persona?.toUpperCase()} · {cfg.label}
        </span>
        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.faint, marginLeft: "auto" }}>
          {timeAgo(msg.created_at)}
        </span>
      </div>

      {/* Voice-distinct body */}
      <div style={{
        fontFamily: isDirector ? T.serif : isWriter ? T.italic : isResearcher ? T.mono : T.sans,
        fontStyle: isWriter ? "italic" : "normal",
        fontSize: isDirector ? 17 : isResearcher ? 13 : 14,
        color: isResearcher ? T.sub : T.body,
        lineHeight: isDirector ? 1.7 : isResearcher ? 1.8 : 1.65,
        whiteSpace: "pre-wrap",
        background: isResearcher ? `${T.surf}` : "transparent",
        padding: isResearcher ? "10px 12px" : 0,
        border: isResearcher ? `1px solid ${T.bdr}` : "none",
        borderRadius: isResearcher ? 4 : 0,
      }}>
        {msg.content}
      </div>
    </div>
  );
}

interface Room { id: string; name: string; description: string | null; room_type?: string; }
interface RoomEntry { role: string; rooms: Room & { message_count?: number; last_message_at?: string | null }; }

export default function ReviewClient({ expiresAt, label, canWrite }: {
  expiresAt: number;
  label: string;
  canWrite: boolean;
}) {
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [viewCount, setViewCount] = useState(0);

  useEffect(() => {
    fetch("/api/rooms").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setRooms(data);
      setLoadingRooms(false);
    }).catch(() => setLoadingRooms(false));
  }, []);

  useEffect(() => {
    if (!selectedRoom) return;
    setLoadingMsgs(true);
    setViewCount(v => v + 1);
    fetch(`/api/messages?roomId=${selectedRoom.id}`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setMessages(data);
      setLoadingMsgs(false);
    }).catch(() => setLoadingMsgs(false));
  }, [selectedRoom?.id]);

  const expired = expiresAt * 1000 < Date.now();

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.sans, display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&family=DM+Serif+Display:ital@0;1&family=Source+Serif+Pro:ital,wght@1,400&display=swap'); *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${T.bdr2}; border-radius: 2px; }`}</style>

      {/* Header */}
      <div style={{ padding: "14px 24px", borderBottom: `1px solid ${T.bdr}`, background: "#0c0c0e", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {["◈","✦","⌘","⚡","◎"].map((icon, i) => (
              <span key={i} style={{ color: ["#0fe898","#4da8ff","#ffca00","#ff5a5a","#c89cff"][i], fontSize: 13 }}>{icon}</span>
            ))}
          </div>
          <div style={{ width: 1, height: 14, background: T.bdr2 }} />
          <span style={{ fontFamily: T.mono, fontSize: 9, color: T.meta, letterSpacing: "0.14em" }}>WRITERS ROOM · AI REVIEW MODE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontFamily: T.mono, fontSize: 9, color: canWrite ? "#0fe898" : T.meta, background: T.surf, border: `1px solid ${T.bdr2}`, padding: "3px 8px", borderRadius: 3 }}>
              {canWrite ? "READ + WRITE" : "READ ONLY"}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 9, color: expired ? "#ff5a5a" : "#f5b041", background: T.surf, border: `1px solid ${T.bdr2}`, padding: "3px 8px", borderRadius: 3 }}>
              {expired ? "EXPIRED" : expiryLabel(expiresAt)}
            </span>
          </div>
          <span style={{ fontFamily: T.sans, fontSize: 12, color: T.sub }}>{label}</span>
        </div>
      </div>

      {expired && (
        <div style={{ background: "#ff5a5a18", border: "1px solid #ff5a5a33", borderRadius: 6, padding: "10px 16px", margin: "16px 24px", fontFamily: T.mono, fontSize: 11, color: "#ff5a5a" }}>
          This review session has expired. Ask the room owner to generate a new link.
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Room list sidebar */}
        <div style={{ width: 240, borderRight: `1px solid ${T.bdr}`, overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "16px 16px 8px", fontFamily: T.mono, fontSize: 9, color: T.meta, letterSpacing: "0.12em" }}>ROOMS</div>
          {loadingRooms ? (
            <div style={{ padding: "12px 16px", fontFamily: T.mono, fontSize: 11, color: T.faint }}>Loading…</div>
          ) : rooms.length === 0 ? (
            <div style={{ padding: "12px 16px", fontFamily: T.mono, fontSize: 11, color: T.faint }}>No rooms accessible</div>
          ) : (
            rooms.map(entry => {
              const room = entry.rooms;
              const isActive = selectedRoom?.id === room.id;
              return (
                <button key={room.id} onClick={() => setSelectedRoom(room)}
                  style={{ width: "100%", textAlign: "left", padding: "10px 16px", background: isActive ? "#4da8ff0f" : "none", borderLeft: isActive ? "2px solid #4da8ff" : "2px solid transparent", border: "none", borderBottom: `1px solid ${T.bdr}`, cursor: "pointer", display: "block" }}>
                  <div style={{ fontFamily: T.sans, fontSize: 13, color: isActive ? "#4da8ff" : T.text, marginBottom: 3 }}>{room.name}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: T.meta }}>
                    {room.message_count != null ? `${room.message_count} messages` : ""}
                    {room.last_message_at ? ` · ${timeAgo(room.last_message_at)}` : ""}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Message view */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", maxWidth: 820 }}>
          {!selectedRoom ? (
            <div style={{ paddingTop: 60, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◎</div>
              <p style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 18, color: T.sub }}>Select a room to read the conversation.</p>
            </div>
          ) : loadingMsgs ? (
            <div style={{ paddingTop: 40, fontFamily: T.mono, fontSize: 11, color: T.faint }}>Loading messages…</div>
          ) : (
            <>
              {/* Room header */}
              <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${T.bdr}` }}>
                <h1 style={{ fontFamily: T.serif, fontSize: 28, fontWeight: 400, color: T.text, marginBottom: 6 }}>{selectedRoom.name}</h1>
                {selectedRoom.description && (
                  <p style={{ fontFamily: T.sans, fontSize: 13, color: T.sub }}>{selectedRoom.description}</p>
                )}
                <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 9, color: T.meta, letterSpacing: "0.1em" }}>
                    {messages.length} MESSAGES
                  </span>
                  {viewCount > 0 && (
                    <span style={{ fontFamily: T.mono, fontSize: 9, color: T.meta, letterSpacing: "0.1em" }}>
                      {viewCount} VIEW{viewCount !== 1 ? "S" : ""} THIS SESSION
                    </span>
                  )}
                </div>
              </div>

              {/* Messages */}
              {messages.length === 0 ? (
                <p style={{ fontFamily: T.mono, fontSize: 11, color: T.faint }}>No messages yet.</p>
              ) : (
                messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
