"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import type { Room } from "@/types";

export default function RoomsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: "", description: "", is_private: false });
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { fetchRooms(); }, []);

  async function fetchRooms() {
    setLoading(true);
    const res = await fetch("/api/rooms");
    const data = await res.json();
    setRooms(data.map((d: any) => d.rooms).filter(Boolean));
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

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: "7px",
    background: "#0a0a0a", border: "1px solid #2a2a2a",
    color: "#e5e5e5", fontSize: "14px", fontFamily: "var(--font-sans)",
    outline: "none",
  } as React.CSSProperties;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <div style={{
        padding: "16px 32px", borderBottom: "1px solid #1e1e1e",
        background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", gap: "5px" }}>
            {["◈", "✦", "⌘", "⚡", "◎"].map((icon, i) => {
              const colors = ["#34d399", "#60a5fa", "#fbbf24", "#f87171", "#c084fc"];
              return <span key={i} style={{ color: colors[i], fontSize: "13px" }}>{icon}</span>;
            })}
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#666", letterSpacing: "0.1em" }}>
            WRITERS ROOM
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {session?.user?.image && (
            <img src={session.user.image} alt="" style={{ width: "28px", height: "28px", borderRadius: "50%", border: "1px solid #2a2a2a" }} />
          )}
          <span style={{ fontSize: "13px", color: "#888" }}>{session?.user?.name}</span>
          <button onClick={() => signOut()} style={{
            background: "none", border: "1px solid #2a2a2a", color: "#555",
            padding: "4px 12px", borderRadius: "6px", fontSize: "11px",
            fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
          }}>
            SIGN OUT
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "40px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#e5e5e5" }}>Your Rooms</h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => { setShowJoin(true); setShowCreate(false); }} style={{
              padding: "8px 16px", borderRadius: "7px", background: "#111",
              border: "1px solid #2a2a2a", color: "#888", fontSize: "13px",
            }}>
              Join Room
            </button>
            <button onClick={() => { setShowCreate(true); setShowJoin(false); }} style={{
              padding: "8px 16px", borderRadius: "7px", background: "#1d3461",
              border: "1px solid #2d4f8a", color: "#60a5fa", fontSize: "13px",
            }}>
              + New Room
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{
            background: "#111", border: "1px solid #1e1e1e", borderRadius: "10px",
            padding: "24px", marginBottom: "24px", display: "flex", flexDirection: "column", gap: "12px",
          }}>
            <p style={{ fontSize: "13px", color: "#888", fontFamily: "var(--font-mono)" }}>NEW ROOM</p>
            <input placeholder="Room name" value={newRoom.name} onChange={e => setNewRoom(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
            <input placeholder="Description (optional)" value={newRoom.description} onChange={e => setNewRoom(p => ({ ...p, description: e.target.value }))} style={inputStyle} />
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#888", cursor: "pointer" }}>
              <input type="checkbox" checked={newRoom.is_private} onChange={e => setNewRoom(p => ({ ...p, is_private: e.target.checked }))} />
              Private (invite-only)
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={createRoom} style={{ padding: "9px 20px", borderRadius: "7px", background: "#1d3461", border: "1px solid #2d4f8a", color: "#60a5fa", fontSize: "13px" }}>
                Create
              </button>
              <button onClick={() => setShowCreate(false)} style={{ padding: "9px 20px", borderRadius: "7px", background: "none", border: "1px solid #2a2a2a", color: "#666", fontSize: "13px" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Join form */}
        {showJoin && (
          <div style={{
            background: "#111", border: "1px solid #1e1e1e", borderRadius: "10px",
            padding: "24px", marginBottom: "24px", display: "flex", flexDirection: "column", gap: "12px",
          }}>
            <p style={{ fontSize: "13px", color: "#888", fontFamily: "var(--font-mono)" }}>JOIN WITH INVITE CODE</p>
            <input placeholder="Enter invite code" value={inviteCode} onChange={e => { setInviteCode(e.target.value); setError(""); }} style={inputStyle} />
            {error && <p style={{ fontSize: "12px", color: "#f87171" }}>{error}</p>}
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={joinRoom} style={{ padding: "9px 20px", borderRadius: "7px", background: "#1d3461", border: "1px solid #2d4f8a", color: "#60a5fa", fontSize: "13px" }}>
                Join
              </button>
              <button onClick={() => setShowJoin(false)} style={{ padding: "9px 20px", borderRadius: "7px", background: "none", border: "1px solid #2a2a2a", color: "#666", fontSize: "13px" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Room list */}
        {loading ? (
          <p style={{ color: "#444", fontFamily: "var(--font-mono)", fontSize: "12px" }}>Loading...</p>
        ) : rooms.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#444" }}>
            <p style={{ fontSize: "14px", marginBottom: "8px" }}>No rooms yet.</p>
            <p style={{ fontSize: "12px", fontFamily: "var(--font-mono)" }}>Create one or join with an invite code.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {rooms.map(room => (
              <div
                key={room.id}
                onClick={() => router.push(`/rooms/${room.id}`)}
                style={{
                  padding: "18px 20px", background: "#111", border: "1px solid #1e1e1e",
                  borderRadius: "10px", cursor: "pointer", transition: "border-color 0.15s",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e1e1e")}
              >
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 500, color: "#e5e5e5", marginBottom: "4px" }}>
                    {room.name}
                    {room.is_private && <span style={{ marginLeft: "8px", fontSize: "10px", color: "#555", fontFamily: "var(--font-mono)" }}>PRIVATE</span>}
                  </div>
                  {room.description && <div style={{ fontSize: "12px", color: "#666" }}>{room.description}</div>}
                </div>
                <span style={{ color: "#2a2a2a", fontSize: "18px" }}>→</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
