"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import type { Room, RoomType } from "@/types";
import { ROOM_TYPE_CONFIG } from "@/lib/personas";

interface RoomEntry {
  role: "owner" | "member";
  rooms: Room & { message_count?: number; last_message_at?: string | null };
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60)  return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)  return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)    return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7)      return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5)     return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Swipeable room card ───────────────────────────────────────────────────────
// Desktop: hover → ⌫ button → inline confirm
// Mobile:  swipe left ≥52px → snaps to 84px red DELETE zone → tap to delete
function RoomCard({
  entry,
  onOpen,
  onDelete,
  confirmDeleteId,
  setConfirmDeleteId,
  deleting,
  highlightFn,
}: {
  entry: RoomEntry;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  deleting: string | null;
  highlightFn?: (text: string) => React.ReactNode;
}) {
  const room = entry.rooms;
  const isOwner = entry.role === "owner";
  const isConfirming = confirmDeleteId === room.id;
  const isDeleting = deleting === room.id;

  // Swipe state
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const SNAP_THRESHOLD = 52;
  const DELETE_ZONE = 84;

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isOwner) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwiping(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    const dx = touchStartX.current - e.touches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.touches[0].clientY);
    // Cancel if scrolling vertically
    if (dy > Math.abs(dx)) return;
    if (dx < 0) { setSwipeX(0); return; }
    setSwipeX(Math.min(dx, DELETE_ZONE));
  };

  const onTouchEnd = () => {
    setSwiping(false);
    if (swipeX >= SNAP_THRESHOLD) {
      setSwipeX(DELETE_ZONE); // snap open
    } else {
      setSwipeX(0); // snap closed
    }
  };

  const bg = "#0a0a0a", surf = "#111111", bdr = "#1e1e1e", bdr2 = "#2a2a2a";
  const text = "#dcdcdc", sub = "#888888", mono = "'IBM Plex Mono',monospace", sans = "'IBM Plex Sans',sans-serif";

  return (
    <div style={{ position: "relative", marginBottom: 8, overflow: "hidden", borderRadius: 6 }}>
      {/* Red delete zone (behind card, revealed by swipe) */}
      {isOwner && (
        <div
          onClick={() => onDelete(room.id)}
          style={{
            position: "absolute", right: 0, top: 0, bottom: 0,
            width: DELETE_ZONE, background: "#ff3d3d",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <span style={{ fontFamily: mono, fontSize: 10, color: "#fff", letterSpacing: "0.1em" }}>
            {isDeleting ? "…" : "DELETE"}
          </span>
        </div>
      )}

      {/* Card */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          background: surf,
          border: `1px solid ${isConfirming ? "#ff3d3d44" : bdr}`,
          borderRadius: 6,
          transform: `translateX(-${swipeX}px)`,
          transition: swiping ? "none" : "transform 0.22s ease, border-color 0.15s",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* Room info */}
          <div
            onClick={() => !isConfirming && swipeX === 0 && onOpen(room.id)}
            style={{
              flex: 1, padding: "14px 16px",
              cursor: isConfirming || swipeX > 0 ? "default" : "pointer",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500, color: text, marginBottom: 3, display: "flex", alignItems: "center", gap: 8 }}>
              {highlightFn ? highlightFn(room.name) : room.name}
              {room.is_private && (
                <span style={{ fontSize: 9, color: sub, fontFamily: mono, border: `1px solid ${bdr2}`, padding: "1px 5px", borderRadius: 3 }}>
                  PRIVATE
                </span>
              )}
              {(() => {
                const rt = (room as any).room_type as RoomType ?? "writers";
                const cfg = ROOM_TYPE_CONFIG[rt];
                return (
                  <span style={{ fontSize: 9, color: cfg.color, fontFamily: mono, border: `1px solid ${cfg.color}40`, padding: "1px 6px", borderRadius: 3 }}>
                    {cfg.icon} {cfg.label}
                  </span>
                );
              })()}
              {isOwner && (
                <span style={{ fontSize: 9, color: "#0fe89888", fontFamily: mono }}>owner</span>
              )}
            </div>
            {room.description && (
              <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>
                {highlightFn ? highlightFn(room.description) : room.description}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              {room.last_message_at && (
                <span style={{ fontSize: 10, color: "#444", fontFamily: mono }}>
                  {timeAgo(room.last_message_at)}
                </span>
              )}
              {(room.message_count ?? 0) > 0 && (
                <span style={{ fontSize: 10, color: "#444", fontFamily: mono }}>
                  {room.message_count} {room.message_count === 1 ? "message" : "messages"}
                </span>
              )}
              {(room.message_count ?? 0) === 0 && !room.last_message_at && (
                <span style={{ fontSize: 10, color: "#333", fontFamily: mono }}>empty</span>
              )}
            </div>
          </div>

          {/* Desktop delete button */}
          {isOwner && !isConfirming && (
            <button
              onClick={e => { e.stopPropagation(); setConfirmDeleteId(room.id); }}
              title="Delete room"
              style={{
                background: "none", border: "none",
                borderLeft: `1px solid ${bdr}`,
                color: "#444", cursor: "pointer",
                padding: "0 16px", alignSelf: "stretch",
                display: "flex", alignItems: "center",
                fontSize: 15, transition: "color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ff3d3d")}
              onMouseLeave={e => (e.currentTarget.style.color = "#444")}
            >
              ⌫
            </button>
          )}

          {!isConfirming && swipeX === 0 && (
            <span style={{ color: bdr2, fontSize: 18, padding: "0 14px" }}>→</span>
          )}
        </div>

        {/* Inline delete confirmation (desktop) */}
        {isConfirming && (
          <div style={{
            borderTop: "1px solid #ff3d3d33", background: "#ff3d3d0a",
            padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 12, color: "#ff3d3d", fontFamily: mono }}>
              Delete "{room.name}"? This cannot be undone.
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{
                padding: "5px 12px", borderRadius: 5, background: "none",
                border: `1px solid ${bdr2}`, color: sub, fontSize: 12, cursor: "pointer",
              }}>Cancel</button>
              <button onClick={() => onDelete(room.id)} disabled={!!isDeleting} style={{
                padding: "5px 12px", borderRadius: 5,
                background: "#ff3d3d18", border: "1px solid #ff3d3d55",
                color: "#ff3d3d", fontSize: 12, cursor: "pointer",
              }}>
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RoomsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newRoom, setNewRoom] = useState<{ name: string; description: string; is_private: boolean; room_type: RoomType }>({ name: "", description: "", is_private: false, room_type: "writers" });
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchRooms();
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  async function fetchRooms() {
    setLoading(true);
    const res = await fetch("/api/rooms");
    const data = await res.json();
    if (Array.isArray(data)) setRooms(data);
    setLoading(false);
  }

  async function createRoom() {
    if (!newRoom.name.trim()) return;
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRoom), // includes room_type
    });
    if (res.ok) {
      const room = await res.json();
      setShowCreate(false);
      setNewRoom({ name: "", description: "", is_private: false });
      router.push(`/rooms/${room.id}`);
    }
  }

  async function joinRoom() {
    if (!inviteCode.trim()) return;
    const res = await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: inviteCode }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/rooms/${data.room_id}`);
    } else {
      setError("Invalid invite code");
    }
  }

  async function deleteRoom(roomId: string) {
    setDeleting(roomId);
    const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });
    if (res.ok) setRooms(prev => prev.filter(r => r.rooms.id !== roomId));
    setDeleting(null);
    setConfirmDeleteId(null);
  }

  const bg = "#0a0a0a", surf = "#111111", bdr = "#1e1e1e", bdr2 = "#2a2a2a";
  const text = "#dcdcdc", sub = "#888888", mono = "'IBM Plex Mono',monospace", sans = "'IBM Plex Sans',sans-serif";

  const q = searchQuery.trim().toLowerCase();
  const filteredRooms = q
    ? rooms.filter(e =>
        e.rooms.name.toLowerCase().includes(q) ||
        (e.rooms.description ?? "").toLowerCase().includes(q)
      )
    : rooms;

  const highlight = (str: string): React.ReactNode => {
    if (!q) return str;
    const idx = str.toLowerCase().indexOf(q);
    if (idx === -1) return str;
    return (
      <>
        {str.slice(0, idx)}
        <mark style={{ background: "#4da8ff33", color: "#4da8ff", borderRadius: 2, padding: "0 1px" }}>
          {str.slice(idx, idx + q.length)}
        </mark>
        {str.slice(idx + q.length)}
      </>
    );
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 7,
    background: bg, border: `1px solid ${bdr2}`,
    color: text, fontSize: 14, fontFamily: sans, outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: sans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { outline: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${bdr2}; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "0 32px", height: 52,
        borderBottom: `1px solid ${bdr}`, background: "#0d0d0d",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {["◈","✦","⌘","⚡","◎"].map((icon, i) => {
              const colors = ["#0fe898","#4da8ff","#ffca00","#ff3d3d","#c030ff"];
              return <span key={i} style={{ color: colors[i], fontSize: 13 }}>{icon}</span>;
            })}
          </div>
          <span style={{ fontFamily: mono, fontSize: 10, color: sub, letterSpacing: "0.12em" }}>
            ALL ROOMS
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {session?.user?.image && (
            <img src={session.user.image} alt="" style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${bdr2}` }} />
          )}
          <span style={{ fontSize: 13, color: sub }}>{session?.user?.name}</span>
          <button onClick={() => signOut()} style={{
            background: "none", border: `1px solid ${bdr2}`, color: sub,
            padding: "4px 12px", borderRadius: 6, fontSize: 10,
            fontFamily: mono, letterSpacing: "0.08em", cursor: "pointer",
          }}>SIGN OUT</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: text, flexShrink: 0 }}>Your Rooms</h2>

          {/* Search */}
          {rooms.length > 3 && (
            <div style={{ flex: 1, maxWidth: 240, position: "relative" }}>
              <span style={{
                position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)",
                color: "#333", fontSize: 12, pointerEvents: "none",
              }}>⌕</span>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter rooms…"
                style={{
                  width: "100%", padding: "6px 10px 6px 26px",
                  background: surf, border: `1px solid ${searchQuery ? "#4da8ff44" : bdr2}`,
                  borderRadius: 6, color: searchQuery ? "#4da8ff" : sub,
                  fontSize: 12, fontFamily: mono, outline: "none",
                  transition: "border-color 0.15s, color 0.15s",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 14, lineHeight: 1,
                  }}
                >×</button>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => { setShowJoin(true); setShowCreate(false); setError(""); }} style={{
              padding: "7px 14px", borderRadius: 6, background: surf,
              border: `1px solid ${bdr2}`, color: sub, fontSize: 12, cursor: "pointer", fontFamily: mono,
            }}>join room</button>
            <button onClick={() => { setShowCreate(true); setShowJoin(false); }} style={{
              padding: "7px 14px", borderRadius: 6, background: "#0d2240",
              border: "1px solid #4da8ff44", color: "#4da8ff", fontSize: 12, cursor: "pointer", fontFamily: mono,
            }}>+ new room</button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{ background: surf, border: `1px solid ${bdr}`, borderRadius: 8, padding: 20, marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 10, color: sub, fontFamily: mono, letterSpacing: "0.1em" }}>NEW ROOM</p>
            <input placeholder="Room name" value={newRoom.name} onChange={e => setNewRoom(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
            <input placeholder="Description (optional)" value={newRoom.description} onChange={e => setNewRoom(p => ({ ...p, description: e.target.value }))} style={inputStyle} />
            {/* Room type selector */}
            <div>
              <p style={{ fontSize: 10, color: sub, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 8 }}>ROOM TYPE</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {(Object.entries(ROOM_TYPE_CONFIG) as [RoomType, typeof ROOM_TYPE_CONFIG[RoomType]][]).map(([type, cfg]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewRoom(p => ({ ...p, room_type: type }))}
                    style={{
                      padding: "10px 12px", borderRadius: 6, textAlign: "left", cursor: "pointer",
                      background: newRoom.room_type === type ? cfg.color + "18" : surf,
                      border: `1px solid ${newRoom.room_type === type ? cfg.color + "66" : bdr2}`,
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ color: cfg.color, fontSize: 14 }}>{cfg.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: newRoom.room_type === type ? cfg.color : text }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: 10, color: sub, fontFamily: mono }}>{cfg.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: sub, cursor: "pointer" }}>
              <input type="checkbox" checked={newRoom.is_private} onChange={e => setNewRoom(p => ({ ...p, is_private: e.target.checked }))} />
              Private (invite-only)
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={createRoom} style={{ padding: "8px 18px", borderRadius: 6, background: "#0d2240", border: "1px solid #4da8ff44", color: "#4da8ff", fontSize: 13, cursor: "pointer" }}>Create</button>
              <button onClick={() => setShowCreate(false)} style={{ padding: "8px 18px", borderRadius: 6, background: "none", border: `1px solid ${bdr2}`, color: sub, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Join form */}
        {showJoin && (
          <div style={{ background: surf, border: `1px solid ${bdr}`, borderRadius: 8, padding: 20, marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 10, color: sub, fontFamily: mono, letterSpacing: "0.1em" }}>JOIN WITH INVITE CODE</p>
            <input placeholder="Enter invite code" value={inviteCode} onChange={e => { setInviteCode(e.target.value); setError(""); }} style={inputStyle} />
            {error && <p style={{ fontSize: 12, color: "#ff3d3d" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={joinRoom} style={{ padding: "8px 18px", borderRadius: 6, background: "#0d2240", border: "1px solid #4da8ff44", color: "#4da8ff", fontSize: 13, cursor: "pointer" }}>Join</button>
              <button onClick={() => setShowJoin(false)} style={{ padding: "8px 18px", borderRadius: 6, background: "none", border: `1px solid ${bdr2}`, color: sub, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Room list */}
        {loading ? (
          <p style={{ color: "#333", fontFamily: mono, fontSize: 11 }}>Loading…</p>
        ) : rooms.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#444" }}>
            <p style={{ fontSize: 14, marginBottom: 8 }}>No rooms yet.</p>
            <p style={{ fontSize: 11, fontFamily: mono }}>Create one or join with an invite code.</p>
          </div>
        ) : (
          <div>
            {filteredRooms.length === 0 && searchQuery ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ fontSize: 13, color: "#444", marginBottom: 6 }}>No rooms match "{searchQuery}"</p>
                <button onClick={() => setSearchQuery("")} style={{ fontFamily: mono, fontSize: 11, color: sub, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  clear filter
                </button>
              </div>
            ) : (
              filteredRooms.map(entry => (
                <RoomCard
                  key={entry.rooms.id}
                  entry={{ ...entry, rooms: { ...entry.rooms, name: entry.rooms.name, description: entry.rooms.description } }}
                  onOpen={id => router.push(`/rooms/${id}`)}
                  onDelete={deleteRoom}
                  confirmDeleteId={confirmDeleteId}
                  setConfirmDeleteId={setConfirmDeleteId}
                  deleting={deleting}
                  highlightFn={highlight}
                />
              ))
            )}
            {/* Mobile hint */}
            {isMobile && rooms.some(r => r.role === "owner") && !searchQuery && (
              <p style={{ textAlign: "center", fontFamily: mono, fontSize: 9, color: "#333", marginTop: 16, letterSpacing: "0.08em" }}>
                swipe left to delete
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
