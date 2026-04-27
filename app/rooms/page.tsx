"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import type { Room } from "@/types";

// Merged room + membership shape returned by GET /api/rooms
interface RoomEntry {
  role: "owner" | "member";
  rooms: Room;
}

export default function RoomsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: "", description: "", is_private: false });
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  // Track which room card is in "confirm delete" state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { fetchRooms(); }, []);

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
      body: JSON.stringify(newRoom),
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
    if (res.ok) {
      setRooms(prev => prev.filter(r => r.rooms.id !== roomId));
    }
    setDeleting(null);
    setConfirmDeleteId(null);
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const bg    = "#0a0a0a";
  const surf  = "#111111";
  const bdr   = "#1e1e1e";
  const bdr2  = "#2a2a2a";
  const text  = "#dcdcdc";
  const sub   = "#888888";
  const mono  = "'IBM Plex Mono', monospace";
  const sans  = "'IBM Plex Sans', sans-serif";

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
        input:focus, textarea:focus { outline: none; }
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
            WRITERS ROOM
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
          }}>
            SIGN OUT
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: text }}>Your Rooms</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setShowJoin(true); setShowCreate(false); setError(""); }} style={{
              padding: "8px 16px", borderRadius: 7, background: surf,
              border: `1px solid ${bdr2}`, color: sub, fontSize: 13, cursor: "pointer",
            }}>
              Join Room
            </button>
            <button onClick={() => { setShowCreate(true); setShowJoin(false); }} style={{
              padding: "8px 16px", borderRadius: 7, background: "#0d2240",
              border: "1px solid #4da8ff44", color: "#4da8ff", fontSize: 13, cursor: "pointer",
            }}>
              + New Room
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{
            background: surf, border: `1px solid ${bdr}`, borderRadius: 10,
            padding: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 12,
          }}>
            <p style={{ fontSize: 10, color: sub, fontFamily: mono, letterSpacing: "0.1em" }}>NEW ROOM</p>
            <input placeholder="Room name" value={newRoom.name} onChange={e => setNewRoom(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
            <input placeholder="Description (optional)" value={newRoom.description} onChange={e => setNewRoom(p => ({ ...p, description: e.target.value }))} style={inputStyle} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: sub, cursor: "pointer" }}>
              <input type="checkbox" checked={newRoom.is_private} onChange={e => setNewRoom(p => ({ ...p, is_private: e.target.checked }))} />
              Private (invite-only)
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={createRoom} style={{ padding: "9px 20px", borderRadius: 7, background: "#0d2240", border: "1px solid #4da8ff44", color: "#4da8ff", fontSize: 13, cursor: "pointer" }}>Create</button>
              <button onClick={() => setShowCreate(false)} style={{ padding: "9px 20px", borderRadius: 7, background: "none", border: `1px solid ${bdr2}`, color: sub, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Join form */}
        {showJoin && (
          <div style={{
            background: surf, border: `1px solid ${bdr}`, borderRadius: 10,
            padding: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 12,
          }}>
            <p style={{ fontSize: 10, color: sub, fontFamily: mono, letterSpacing: "0.1em" }}>JOIN WITH INVITE CODE</p>
            <input placeholder="Enter invite code" value={inviteCode} onChange={e => { setInviteCode(e.target.value); setError(""); }} style={inputStyle} />
            {error && <p style={{ fontSize: 12, color: "#ff3d3d" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={joinRoom} style={{ padding: "9px 20px", borderRadius: 7, background: "#0d2240", border: "1px solid #4da8ff44", color: "#4da8ff", fontSize: 13, cursor: "pointer" }}>Join</button>
              <button onClick={() => setShowJoin(false)} style={{ padding: "9px 20px", borderRadius: 7, background: "none", border: `1px solid ${bdr2}`, color: sub, fontSize: 13, cursor: "pointer" }}>Cancel</button>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rooms.map(entry => {
              const room = entry.rooms;
              const isOwner = entry.role === "owner";
              const isConfirming = confirmDeleteId === room.id;
              const isDeleting = deleting === room.id;

              return (
                <div key={room.id} style={{
                  background: surf, border: `1px solid ${isConfirming ? "#ff3d3d44" : bdr}`,
                  borderRadius: 10, overflow: "hidden",
                  transition: "border-color 0.15s",
                }}>
                  {/* Main row */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {/* Clickable room info */}
                    <div
                      onClick={() => !isConfirming && router.push(`/rooms/${room.id}`)}
                      style={{
                        flex: 1, padding: "18px 20px", cursor: isConfirming ? "default" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 500, color: text, marginBottom: 3 }}>
                          {room.name}
                          {room.is_private && (
                            <span style={{ marginLeft: 8, fontSize: 9, color: sub, fontFamily: mono, border: `1px solid ${bdr2}`, padding: "1px 5px", borderRadius: 3 }}>
                              PRIVATE
                            </span>
                          )}
                          {isOwner && (
                            <span style={{ marginLeft: 6, fontSize: 9, color: "#0fe89888", fontFamily: mono }}>
                              owner
                            </span>
                          )}
                        </div>
                        {room.description && (
                          <div style={{ fontSize: 12, color: sub }}>{room.description}</div>
                        )}
                      </div>
                      {!isConfirming && (
                        <span style={{ color: bdr2, fontSize: 18 }}>→</span>
                      )}
                    </div>

                    {/* Delete control — owner only */}
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
                          fontSize: 16, transition: "color 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#ff3d3d")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#444")}
                      >
                        ⌫
                      </button>
                    )}
                  </div>

                  {/* Inline delete confirmation */}
                  {isConfirming && (
                    <div style={{
                      borderTop: `1px solid #ff3d3d33`,
                      background: "#ff3d3d0a",
                      padding: "12px 20px",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <span style={{ fontSize: 12, color: "#ff3d3d", fontFamily: mono }}>
                        Delete "{room.name}"? This cannot be undone.
                      </span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{ padding: "5px 14px", borderRadius: 5, background: "none", border: `1px solid ${bdr2}`, color: sub, fontSize: 12, cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteRoom(room.id)}
                          disabled={!!isDeleting}
                          style={{ padding: "5px 14px", borderRadius: 5, background: "#ff3d3d18", border: "1px solid #ff3d3d55", color: "#ff3d3d", fontSize: 12, cursor: "pointer" }}
                        >
                          {isDeleting ? "Deleting…" : "Delete room"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
