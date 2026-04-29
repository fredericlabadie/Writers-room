"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import type { Room, RoomType, Folder, FolderPin } from "@/types";
import { ROOM_TYPE_CONFIG } from "@/lib/personas";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoomEntry {
  role: "owner" | "member";
  rooms: Room & { message_count?: number; last_message_at?: string | null };
}

interface FolderDetail {
  folder: Folder;
  pins: FolderPin[];
  rooms: (Room & { message_count?: number; last_message_at?: string | null })[];
}

// ── Design tokens ─────────────────────────────────────────────────────────────

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
} as const;

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&family=DM+Serif+Display:ital@0;1&family=Source+Serif+Pro:ital,wght@0,400;1,400&display=swap');`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Room card component ───────────────────────────────────────────────────────

function RoomCard({ room, onOpen, onDelete, isOwner, deleting, confirmDeleteId, setConfirmDeleteId }: {
  room: Room & { message_count?: number; last_message_at?: string | null };
  onOpen: () => void;
  onDelete: () => void;
  isOwner: boolean;
  deleting: boolean;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
}) {
  const [hov, setHov] = useState(false);
  const isConfirming = confirmDeleteId === room.id;
  const cfg = ROOM_TYPE_CONFIG[(room.room_type as RoomType) ?? "writers"];

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.surf,
        border: `1px solid ${isConfirming ? "#ff5a5a44" : T.bdr}`,
        borderLeft: `3px solid ${isConfirming ? "#ff5a5a" : cfg.color}`,
        borderRadius: "0 6px 6px 0",
        marginBottom: 6,
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          onClick={() => !isConfirming && onOpen()}
          style={{ flex: 1, padding: "13px 16px", cursor: isConfirming ? "default" : "pointer" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
            <span style={{ fontFamily: T.serif, fontSize: 15, color: T.text, fontWeight: 400 }}>{room.name}</span>
            <span style={{ fontFamily: T.mono, fontSize: 9, color: cfg.color, border: `1px solid ${cfg.color}40`, padding: "1px 6px", borderRadius: 3 }}>
              {cfg.icon} {cfg.label}
            </span>
            {room.is_private && (
              <span style={{ fontFamily: T.mono, fontSize: 9, color: T.sub, border: `1px solid ${T.bdr2}`, padding: "1px 5px", borderRadius: 3 }}>PRIVATE</span>
            )}
            {isOwner && <span style={{ fontFamily: T.mono, fontSize: 9, color: "#0fe89888" }}>owner</span>}
          </div>
          {room.description && (
            <div style={{ fontSize: 12, color: T.sub, marginBottom: 4 }}>{room.description}</div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            {room.last_message_at && (
              <span style={{ fontFamily: T.mono, fontSize: 10, color: "#444" }}>{timeAgo(room.last_message_at)}</span>
            )}
            {(room.message_count ?? 0) > 0 && (
              <span style={{ fontFamily: T.mono, fontSize: 10, color: "#444" }}>{room.message_count} messages</span>
            )}
            {(room.message_count ?? 0) === 0 && !room.last_message_at && (
              <span style={{ fontFamily: T.mono, fontSize: 10, color: "#333" }}>empty</span>
            )}
          </div>
        </div>

        {isOwner && !isConfirming && hov && (
          <button
            onClick={e => { e.stopPropagation(); setConfirmDeleteId(room.id); }}
            style={{ background: "none", border: "none", borderLeft: `1px solid ${T.bdr}`, color: "#444", cursor: "pointer", padding: "0 16px", alignSelf: "stretch", fontSize: 15, transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#ff5a5a")}
            onMouseLeave={e => (e.currentTarget.style.color = "#444")}
          >⌫</button>
        )}

        {!isConfirming && (
          <span style={{ color: T.faint, fontSize: 18, padding: "0 14px" }}>→</span>
        )}
      </div>

      {isConfirming && (
        <div style={{ borderTop: "1px solid #ff5a5a33", background: "#ff5a5a0a", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#ff5a5a", fontFamily: T.mono }}>Delete "{room.name}"? Cannot be undone.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDeleteId(null)} style={{ padding: "5px 12px", borderRadius: 5, background: "none", border: `1px solid ${T.bdr2}`, color: T.sub, fontSize: 12, cursor: "pointer" }}>Cancel</button>
            <button onClick={onDelete} disabled={deleting} style={{ padding: "5px 12px", borderRadius: 5, background: "#ff5a5a18", border: "1px solid #ff5a5a55", color: "#ff5a5a", fontSize: 12, cursor: "pointer" }}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Folder pin component ──────────────────────────────────────────────────────

function PinCard({ pin, onDelete, canDelete }: { pin: FolderPin; onDelete: () => void; canDelete: boolean }) {
  const dirColor = "#c89cff";
  return (
    <div style={{ padding: "9px 10px", marginBottom: 6, background: dirColor + "08", border: `1px solid ${dirColor}33`, borderLeft: `2px solid ${dirColor}`, borderRadius: "0 4px 4px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ color: dirColor, fontSize: 10 }}>◎</span>
        <span style={{ fontFamily: T.mono, fontSize: 9, color: dirColor, letterSpacing: "0.08em" }}>FOLDER PIN</span>
        {canDelete && (
          <button onClick={onDelete} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.meta, fontSize: 13, lineHeight: 1 }}>×</button>
        )}
      </div>
      <div style={{ fontFamily: T.serif, fontSize: 12.5, lineHeight: 1.5, color: T.body }}>{pin.text}</div>
    </div>
  );
}

// ── Create room form (inline panel) ──────────────────────────────────────────

function CreateRoomPanel({ folderId, onClose, onCreate }: { folderId?: string; onClose: () => void; onCreate: (room: Room) => void }) {
  const [form, setForm] = useState({ name: "", description: "", is_private: false, room_type: "writers" as RoomType });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, folder_id: folderId || null }),
    });
    if (res.ok) {
      const room = await res.json();
      onCreate(room);
    }
    setSaving(false);
  };

  const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 6, background: T.bg, border: `1px solid ${T.bdr2}`, color: T.text, fontSize: 13, fontFamily: T.sans, outline: "none" };

  return (
    <div style={{ background: T.surf, border: `1px solid ${T.bdr}`, borderRadius: 8, padding: 18, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontFamily: T.mono, fontSize: 9, color: T.sub, letterSpacing: "0.12em" }}>NEW ROOM{folderId ? " IN THIS FOLDER" : ""}</p>
      <input placeholder="Room name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
      <input placeholder="Description (optional)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={inputStyle} />
      <div>
        <p style={{ fontFamily: T.mono, fontSize: 9, color: T.sub, letterSpacing: "0.1em", marginBottom: 8 }}>ROOM TYPE</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {(Object.entries(ROOM_TYPE_CONFIG) as [RoomType, typeof ROOM_TYPE_CONFIG[RoomType]][]).map(([type, cfg]) => (
            <button key={type} onClick={() => setForm(p => ({ ...p, room_type: type }))} style={{ padding: "9px 12px", borderRadius: 6, textAlign: "left", cursor: "pointer", background: form.room_type === type ? cfg.color + "18" : T.surf, border: `1px solid ${form.room_type === type ? cfg.color + "66" : T.bdr2}`, transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ color: cfg.color, fontSize: 13 }}>{cfg.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: form.room_type === type ? cfg.color : T.text }}>{cfg.label}</span>
              </div>
              <div style={{ fontSize: 10, color: T.sub, fontFamily: T.mono }}>{cfg.description}</div>
            </button>
          ))}
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.sub, cursor: "pointer" }}>
        <input type="checkbox" checked={form.is_private} onChange={e => setForm(p => ({ ...p, is_private: e.target.checked }))} />
        Private (invite-only)
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleCreate} disabled={saving || !form.name.trim()} style={{ padding: "8px 18px", borderRadius: 6, background: "#0d2240", border: "1px solid #4da8ff44", color: "#4da8ff", fontSize: 13, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Creating…" : "Create"}</button>
        <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 6, background: "none", border: `1px solid ${T.bdr2}`, color: T.sub, fontSize: 13, cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Create folder form (inline panel) ────────────────────────────────────────

function CreateFolderPanel({ onClose, onCreate }: { onClose: () => void; onCreate: (folder: Folder) => void }) {
  const [form, setForm] = useState({ name: "", description: "", genre: "", reader: "", tone: "", about: "" });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { const folder = await res.json(); onCreate(folder); }
    setSaving(false);
  };

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 6, background: T.bg, border: `1px solid ${T.bdr2}`, color: T.text, fontSize: 13, fontFamily: T.sans, outline: "none" };
  const ta: React.CSSProperties = { ...inp, resize: "vertical", minHeight: 64, fontFamily: T.sans };

  return (
    <div style={{ background: T.surf, border: `1px solid ${T.bdr}`, borderRadius: 8, padding: 18, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontFamily: T.mono, fontSize: 9, color: T.sub, letterSpacing: "0.12em" }}>NEW FOLDER</p>
      <input placeholder="Project name (e.g. Ash in the Lamplight)" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inp} />
      <input placeholder="Genre / form (e.g. Literary fiction)" value={form.genre} onChange={e => setForm(p => ({ ...p, genre: e.target.value }))} style={inp} />
      <input placeholder="Target reader / comp titles (e.g. Mantel · Doerr)" value={form.reader} onChange={e => setForm(p => ({ ...p, reader: e.target.value }))} style={inp} />
      <input placeholder="Tone guidance (e.g. Restrained · period-precise · dread in objects)" value={form.tone} onChange={e => setForm(p => ({ ...p, tone: e.target.value }))} style={inp} />
      <textarea placeholder="About this project — what agents will know before every reply…" value={form.about} onChange={e => setForm(p => ({ ...p, about: e.target.value }))} style={ta} />
      <p style={{ fontFamily: T.mono, fontSize: 9, color: T.meta, letterSpacing: "0.06em" }}>GENRE, READER, TONE AND ABOUT are injected into every agent call in rooms under this folder.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleCreate} disabled={saving || !form.name.trim()} style={{ padding: "8px 18px", borderRadius: 6, background: "#0d2240", border: "1px solid #4da8ff44", color: "#4da8ff", fontSize: 13, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Creating…" : "Create folder"}</button>
        <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 6, background: "none", border: `1px solid ${T.bdr2}`, color: T.sub, fontSize: 13, cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Folder view (main content when a folder is selected) ──────────────────────

function FolderView({ folderId, onOpenRoom, onRoomCreated, onDeleteRoom }: {
  folderId: string;
  onOpenRoom: (id: string) => void;
  onRoomCreated: () => void;
  onDeleteRoom: (id: string) => void;
}) {
  const [detail, setDetail] = useState<FolderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showAddPin, setShowAddPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/folders/${folderId}`);
    if (res.ok) setDetail(await res.json());
    setLoading(false);
  }, [folderId]);

  useEffect(() => { load(); }, [load]);

  const deleteRoom = async (roomId: string) => {
    setDeleting(roomId);
    await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });
    setDetail(prev => prev ? { ...prev, rooms: prev.rooms.filter(r => r.id !== roomId) } : prev);
    setDeleting(null);
    setConfirmDeleteId(null);
    onDeleteRoom(roomId);
  };

  const addPin = async () => {
    if (!pinInput.trim()) return;
    const res = await fetch(`/api/folders/${folderId}/pins`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: pinInput }) });
    if (res.ok) { const pin = await res.json(); setDetail(prev => prev ? { ...prev, pins: [...prev.pins, pin] } : prev); setPinInput(""); setShowAddPin(false); }
  };

  const removePin = async (pinId: string) => {
    await fetch(`/api/folders/${folderId}/pins/${pinId}`, { method: "DELETE" });
    setDetail(prev => prev ? { ...prev, pins: prev.pins.filter(p => p.id !== pinId) } : prev);
  };

  if (loading) return <div style={{ padding: 32, fontFamily: T.mono, fontSize: 11, color: "#333" }}>Loading…</div>;
  if (!detail) return <div style={{ padding: 32, fontFamily: T.mono, fontSize: 11, color: "#ff5a5a" }}>Folder not found.</div>;

  const { folder, pins, rooms } = detail;
  const dirColor = "#c89cff";
  const writerColor = "#4da8ff";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      {/* Breadcrumb */}
      <div style={{ height: 46, padding: "0 28px", borderBottom: `1px solid ${T.bdr}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.meta, letterSpacing: "0.1em" }}>PROJECTS</span>
        <span style={{ color: T.faint }}>/</span>
        <span style={{ color: writerColor, fontSize: 12 }}>◬</span>
        <span style={{ fontFamily: T.serif, fontSize: 14, color: T.text }}>{folder.name}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.meta }}>{rooms.length} rooms · {pins.length} pins</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 40px" }}>
        {/* Folder hero */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 28, marginBottom: 28, paddingBottom: 24, borderBottom: `1px solid ${T.bdr}` }}>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: writerColor, letterSpacing: "0.16em", marginBottom: 8 }}>★ FOLDER LORE · INHERITED BY ALL {rooms.length} ROOMS</div>
            <h1 style={{ fontFamily: T.serif, fontSize: 30, fontWeight: 400, color: T.text, margin: "0 0 10px", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{folder.name}</h1>
            {folder.about && (
              <p style={{ fontFamily: "'Source Serif Pro', serif", fontStyle: "italic", fontSize: 14, lineHeight: 1.6, color: T.body, maxWidth: 560, marginBottom: 14 }}>{folder.about}</p>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {folder.genre  && <FolderTag label="GENRE"  value={folder.genre} />}
              {folder.reader && <FolderTag label="READER" value={folder.reader} />}
              {folder.tone   && <FolderTag label="TONE"   value={folder.tone} />}
            </div>
          </div>

          {/* Cascade card */}
          <div style={{ background: T.surf, border: `1px solid ${T.bdr}`, borderRadius: 6, padding: "14px 16px" }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.meta, letterSpacing: "0.12em", marginBottom: 10 }}>CASCADES INTO EVERY ROOM</div>
            <CascadeRow icon="◎" color={dirColor} label="Folder pins" detail={`${pins.length} directions inherited`} />
            <CascadeRow icon="◐" color="#f5b041" label="Stage" detail="genre · reader · tone" />
            {folder.about && <CascadeRow icon="✎" color={T.body} label="Project about" detail={folder.about.slice(0, 48) + (folder.about.length > 48 ? "…" : "")} />}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.bdr}`, fontFamily: T.mono, fontSize: 9, color: T.sub, letterSpacing: "0.04em", lineHeight: 1.5 }}>
              Rooms can override any field. Override shown with a • dot.
            </div>
          </div>
        </div>

        {/* Folder pins */}
        {(pins.length > 0 || showAddPin) && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: T.mono, fontSize: 9, color: T.meta, letterSpacing: "0.12em" }}>FOLDER PINS</span>
              <button onClick={() => setShowAddPin(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: dirColor, fontFamily: T.mono, fontSize: 9, letterSpacing: "0.08em" }}>+ ADD</button>
            </div>
            {pins.map(pin => <PinCard key={pin.id} pin={pin} canDelete onDelete={() => removePin(pin.id)} />)}
            {showAddPin && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  value={pinInput} onChange={e => setPinInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addPin(); if (e.key === "Escape") setShowAddPin(false); }}
                  placeholder="Pin a direction that applies to all rooms…"
                  style={{ flex: 1, padding: "8px 12px", background: T.bg, border: `1px solid ${dirColor}44`, borderRadius: 5, color: T.text, fontSize: 13, fontFamily: T.sans, outline: "none" }}
                  autoFocus
                />
                <button onClick={addPin} style={{ padding: "8px 14px", background: dirColor + "18", border: `1px solid ${dirColor}55`, borderRadius: 5, color: dirColor, fontFamily: T.mono, fontSize: 10, cursor: "pointer" }}>PIN</button>
              </div>
            )}
          </div>
        )}

        {/* Rooms in folder */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontFamily: T.mono, fontSize: 9, color: T.meta, letterSpacing: "0.12em" }}>ROOMS · {rooms.length}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {!showAddPin && pins.length === 0 && (
              <button onClick={() => setShowAddPin(true)} style={{ fontFamily: T.mono, fontSize: 9, color: T.sub, background: "none", border: `1px solid ${T.bdr2}`, padding: "4px 10px", borderRadius: 4, cursor: "pointer" }}>+ folder pin</button>
            )}
            <button onClick={() => setShowCreateRoom(s => !s)} style={{ fontFamily: T.mono, fontSize: 9, color: "#4da8ff", background: "#4da8ff18", border: "1px solid #4da8ff44", padding: "4px 10px", borderRadius: 4, cursor: "pointer" }}>+ new room</button>
          </div>
        </div>

        {showCreateRoom && (
          <CreateRoomPanel
            folderId={folderId}
            onClose={() => setShowCreateRoom(false)}
            onCreate={room => { setDetail(prev => prev ? { ...prev, rooms: [room as any, ...prev.rooms] } : prev); setShowCreateRoom(false); onRoomCreated(); }}
          />
        )}

        {rooms.length === 0 && !showCreateRoom ? (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <p style={{ fontFamily: T.mono, fontSize: 11, color: "#333" }}>No rooms yet in this folder.</p>
          </div>
        ) : (
          rooms.map(room => (
            <RoomCard
              key={room.id}
              room={room}
              onOpen={() => onOpenRoom(room.id)}
              onDelete={() => deleteRoom(room.id)}
              isOwner={true}
              deleting={deleting === room.id}
              confirmDeleteId={confirmDeleteId}
              setConfirmDeleteId={setConfirmDeleteId}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Cascade row helper ────────────────────────────────────────────────────────

function CascadeRow({ icon, color, label, detail }: { icon: string; color: string; label: string; detail: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "5px 0" }}>
      <span style={{ color, fontSize: 12, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.sans, fontSize: 11, color: T.text }}>{label}</div>
        <div style={{ fontFamily: T.mono, fontSize: 9, color: T.meta, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</div>
      </div>
    </div>
  );
}

function FolderTag({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "4px 10px", background: T.surf, border: `1px solid ${T.bdr}`, borderRadius: 13 }}>
      <span style={{ fontFamily: T.mono, fontSize: 9, color: T.meta, letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ fontFamily: T.sans, fontSize: 11, color: T.text }}>{value}</span>
    </span>
  );
}

// ── All rooms view ────────────────────────────────────────────────────────────

function AllRoomsView({ rooms, onOpen, onRefresh }: { rooms: RoomEntry[]; onOpen: (id: string) => void; onRefresh: () => void }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const deleteRoom = async (roomId: string) => {
    setDeleting(roomId);
    await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });
    onRefresh();
    setDeleting(null);
    setConfirmDeleteId(null);
  };

  const joinRoom = async () => {
    if (!inviteCode.trim()) return;
    const res = await fetch("/api/rooms/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invite_code: inviteCode }) });
    if (res.ok) { const data = await res.json(); router.push(`/rooms/${data.room_id}`); }
    else setError("Invalid invite code");
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = q ? rooms.filter(e => e.rooms.name.toLowerCase().includes(q) || (e.rooms.description ?? "").toLowerCase().includes(q)) : rooms;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.meta, letterSpacing: "0.12em" }}>ALL ROOMS · {rooms.length}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setShowJoin(true); setShowCreate(false); setError(""); }} style={{ padding: "6px 13px", borderRadius: 5, background: T.surf, border: `1px solid ${T.bdr2}`, color: T.sub, fontSize: 12, cursor: "pointer", fontFamily: T.mono }}>join room</button>
          <button onClick={() => { setShowCreate(true); setShowJoin(false); }} style={{ padding: "6px 13px", borderRadius: 5, background: "#0d2240", border: "1px solid #4da8ff44", color: "#4da8ff", fontSize: 12, cursor: "pointer", fontFamily: T.mono }}>+ new room</button>
        </div>
      </div>

      {rooms.length > 4 && (
        <div style={{ position: "relative", marginBottom: 14 }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Filter rooms…"
            style={{ width: "100%", padding: "7px 12px 7px 28px", background: T.surf, border: `1px solid ${searchQuery ? "#4da8ff44" : T.bdr2}`, borderRadius: 6, color: searchQuery ? "#4da8ff" : T.sub, fontSize: 12, fontFamily: T.mono, outline: "none" }} />
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#333", fontSize: 13, pointerEvents: "none" }}>⌕</span>
        </div>
      )}

      {showCreate && (
        <CreateRoomPanel onClose={() => setShowCreate(false)} onCreate={room => { setShowCreate(false); router.push(`/rooms/${room.id}`); }} />
      )}

      {showJoin && (
        <div style={{ background: T.surf, border: `1px solid ${T.bdr}`, borderRadius: 8, padding: 18, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontFamily: T.mono, fontSize: 9, color: T.sub, letterSpacing: "0.12em" }}>JOIN WITH INVITE CODE</p>
          <input placeholder="Enter invite code" value={inviteCode} onChange={e => { setInviteCode(e.target.value); setError(""); }}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 6, background: T.bg, border: `1px solid ${T.bdr2}`, color: T.text, fontSize: 13, fontFamily: T.sans, outline: "none" }} />
          {error && <p style={{ fontSize: 12, color: "#ff5a5a" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={joinRoom} style={{ padding: "8px 18px", borderRadius: 6, background: "#0d2240", border: "1px solid #4da8ff44", color: "#4da8ff", fontSize: 13, cursor: "pointer" }}>Join</button>
            <button onClick={() => setShowJoin(false)} style={{ padding: "8px 18px", borderRadius: 6, background: "none", border: `1px solid ${T.bdr2}`, color: T.sub, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {filtered.length === 0 && searchQuery ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ fontSize: 13, color: "#444" }}>No rooms match "{searchQuery}"</p>
          <button onClick={() => setSearchQuery("")} style={{ fontFamily: T.mono, fontSize: 11, color: T.sub, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginTop: 6 }}>clear</button>
        </div>
      ) : rooms.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 16 }}>
            {["◈","✦","⌘","⚡","◎"].map((icon, i) => {
              const colors = ["#0fe898","#4da8ff","#ffca00","#ff5a5a","#c89cff"];
              return <span key={i} style={{ color: colors[i], fontSize: 20 }}>{icon}</span>;
            })}
          </div>
          <p style={{ fontSize: 14, color: "#555", marginBottom: 6 }}>No rooms yet</p>
          <p style={{ fontSize: 11, color: "#333", fontFamily: T.mono }}>Create a room or folder to get started</p>
        </div>
      ) : (
        filtered.map(entry => (
          <RoomCard
            key={entry.rooms.id}
            room={entry.rooms}
            onOpen={() => onOpen(entry.rooms.id)}
            onDelete={() => deleteRoom(entry.rooms.id)}
            isOwner={entry.role === "owner"}
            deleting={deleting === entry.rooms.id}
            confirmDeleteId={confirmDeleteId}
            setConfirmDeleteId={setConfirmDeleteId}
          />
        ))
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RoomsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selectedView, setSelectedView] = useState<"all" | string>("all"); // "all" or folder id
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roomsVersion, setRoomsVersion] = useState(0); // bump to trigger re-fetch

  useEffect(() => {
    fetchAll();
  }, [roomsVersion]);

  async function fetchAll() {
    setLoadingRooms(true);
    const [roomsRes, foldersRes] = await Promise.all([fetch("/api/rooms"), fetch("/api/folders")]);
    if (roomsRes.ok) setRooms(await roomsRes.json());
    if (foldersRes.ok) setFolders(await foldersRes.json());
    setLoadingRooms(false);
  }

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openRoom = (id: string) => router.push(`/rooms/${id}`);

  // Rooms not in any folder
  const unfolderedRooms = rooms.filter(e => !e.rooms.folder_id);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.sans, display: "flex", flexDirection: "column" }}>
      <style>{`${FONTS} *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } input, textarea { font-family: inherit; } input:focus, textarea:focus { outline: none; } ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${T.bdr2}; border-radius: 2px; } .sidebar-overlay { display: none; } .sidebar-toggle { display: none; } @media (max-width: 700px) { .sidebar { position: fixed !important; top: 0; left: 0; bottom: 0; width: 260px !important; z-index: 100; transform: translateX(-260px); transition: transform 0.22s ease; } .sidebar.open { transform: translateX(0); } .sidebar-overlay { display: block; position: fixed; inset: 0; z-index: 99; background: rgba(0,0,0,0.55); } .sidebar-toggle { display: flex !important; } }`}</style>

      {/* ── Top bar ── */}
      <div style={{ padding: "0 24px", height: 52, borderBottom: `1px solid ${T.bdr}`, background: T.bg2, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Mobile sidebar toggle — hidden on desktop via CSS */}
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(s => !s)}
            style={{ display: "none", background: "none", border: `1px solid ${T.bdr2}`, borderRadius: 5, cursor: "pointer", color: T.sub, padding: "4px 8px", fontSize: 14, lineHeight: 1, marginRight: 4 }}
          >☰</button>
          <div style={{ display: "flex", gap: 6 }}>
            {[{ icon: "◈", color: "#0fe898" },{ icon: "✦", color: "#4da8ff" },{ icon: "⌘", color: "#ffca00" },{ icon: "⚡", color: "#ff5a5a" },{ icon: "◎", color: "#c89cff" }].map((a, i) => (
              <span key={i} style={{ color: a.color, fontSize: 13 }}>{a.icon}</span>
            ))}
          </div>
          <div style={{ width: 1, height: 14, background: T.bdr2 }} />
          <span style={{ fontFamily: T.mono, fontSize: 9, color: "#444", letterSpacing: "0.14em" }}>WRITERS ROOM</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {session?.user?.image && <img src={session.user.image} alt="" style={{ width: 24, height: 24, borderRadius: "50%", border: `1px solid ${T.bdr2}` }} />}
          <span style={{ fontSize: 12, color: T.sub }}>{session?.user?.name}</span>
          <div style={{ width: 1, height: 14, background: T.bdr2 }} />
          <button onClick={() => signOut()} style={{ background: "none", border: "none", color: "#444", fontSize: 9, fontFamily: T.mono, letterSpacing: "0.1em", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.color = T.sub)} onMouseLeave={e => (e.currentTarget.style.color = "#444")}>SIGN OUT</button>
        </div>
      </div>

      {/* ── Layout ── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

        {/* Overlay — tapping it closes the sidebar on mobile */}
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        {/* ── Sidebar — desktop: inline; mobile: slide-in drawer ── */}
        <div
          className={`sidebar${sidebarOpen ? " open" : ""}`}
          style={{ width: 260, background: T.bg2, borderRight: `1px solid ${T.bdr}`, display: "flex", flexDirection: "column", flexShrink: 0 }}
        >
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>

            {/* Navigation */}
            <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 4 }}>
              {[
                { id: "all", icon: "◍", label: "All rooms", count: rooms.length },
              ].map(item => (
                <button key={item.id} onClick={() => { setSelectedView(item.id); setSidebarOpen(false); }} style={{ display: "grid", gridTemplateColumns: "16px 1fr auto", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 5, cursor: "pointer", background: selectedView === item.id ? T.surf : "transparent", border: selectedView === item.id ? `1px solid ${T.bdr2}` : "1px solid transparent", textAlign: "left" }}>
                  <span style={{ color: T.sub, fontSize: 12 }}>{item.icon}</span>
                  <span style={{ fontSize: 12.5, color: selectedView === item.id ? T.text : T.body }}>{item.label}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.meta }}>{item.count}</span>
                </button>
              ))}
            </div>

            {/* Projects section */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px 6px" }}>
                <button
                  onClick={() => setProjectsOpen(s => !s)}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  <span style={{ fontFamily: T.mono, fontSize: 9, color: T.meta, letterSpacing: "0.12em" }}>PROJECTS</span>
                  <span style={{ fontFamily: T.mono, fontSize: 9, color: T.faint, lineHeight: 1 }}>{projectsOpen ? "▾" : "▸"}</span>
                </button>
                {projectsOpen && (
                  <button onClick={() => setShowCreateFolder(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: T.faint, fontSize: 14, lineHeight: 1, padding: "0 2px" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#4da8ff")} onMouseLeave={e => (e.currentTarget.style.color = T.faint)}>+</button>
                )}
              </div>

              {projectsOpen && (
                <>
                  {showCreateFolder && (
                    <div style={{ padding: "4px 0" }}>
                      <CreateFolderPanel
                        onClose={() => setShowCreateFolder(false)}
                        onCreate={folder => { setFolders(prev => [folder, ...prev]); setShowCreateFolder(false); setSelectedView(folder.id); }}
                      />
                    </div>
                  )}

                  {folders.length === 0 && !showCreateFolder && (
                    <div style={{ padding: "8px 10px", fontFamily: T.mono, fontSize: 10, color: "#333" }}>No projects yet — press + to create one</div>
                  )}

                  {folders.map(folder => {
                    const isOpen = expandedFolders.has(folder.id);
                    const isSelected = selectedView === folder.id;
                    const folderRooms = rooms.filter(e => e.rooms.folder_id === folder.id);
                    return (
                      <div key={folder.id}>
                        <div style={{ display: "grid", gridTemplateColumns: "14px 16px 1fr auto", alignItems: "center", gap: 5, padding: "7px 10px", borderRadius: 5, cursor: "pointer", background: isSelected ? T.surf : "transparent" }}
                          onClick={() => { setSelectedView(folder.id); setSidebarOpen(false); if (!isOpen) toggleFolder(folder.id); }}>
                          <button onClick={e => { e.stopPropagation(); toggleFolder(folder.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: T.meta, fontSize: 9, padding: 0, lineHeight: 1 }}>{isOpen ? "▾" : "▸"}</button>
                          <span style={{ color: "#4da8ff", fontSize: 12 }}>◬</span>
                          <span style={{ fontSize: 12.5, color: isSelected ? T.text : T.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.name}</span>
                          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.meta }}>{folder.room_count ?? 0}</span>
                        </div>
                        {isOpen && folderRooms.length > 0 && (
                          <div style={{ marginLeft: 16, borderLeft: `1px solid #4da8ff33`, paddingLeft: 10, marginTop: 1, marginBottom: 4 }}>
                            {folderRooms.map(entry => (
                              <button key={entry.rooms.id} onClick={() => openRoom(entry.rooms.id)} style={{ display: "block", width: "100%", padding: "5px 8px", fontSize: 12, color: T.sub, cursor: "pointer", borderRadius: 4, background: "transparent", border: "none", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                onMouseEnter={e => (e.currentTarget.style.background = T.surf)} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                {entry.rooms.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* User footer */}
          <div style={{ padding: "10px 14px", borderTop: `1px solid ${T.bdr}`, display: "flex", alignItems: "center", gap: 8 }}>
            {session?.user?.image
              ? <img src={session.user.image} alt="" style={{ width: 24, height: 24, borderRadius: "50%", border: `1px solid ${T.bdr2}` }} />
              : <div style={{ width: 24, height: 24, borderRadius: "50%", background: T.surf2, border: `1px solid ${T.bdr2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#4da8ff" }}>{session?.user?.name?.[0] ?? "?"}</div>
            }
            <span style={{ fontSize: 12, color: T.sub, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session?.user?.name}</span>
            <span style={{ color: T.meta, fontSize: 14, cursor: "pointer" }}>⋯</span>
          </div>
        </div>

        {/* ── Main content ── */}
        {selectedView === "all" ? (
          <AllRoomsView rooms={unfolderedRooms} onOpen={openRoom} onRefresh={() => setRoomsVersion(v => v + 1)} />
        ) : (
          <FolderView
            key={selectedView}
            folderId={selectedView}
            onOpenRoom={openRoom}
            onRoomCreated={() => setRoomsVersion(v => v + 1)}
            onDeleteRoom={() => setRoomsVersion(v => v + 1)}
          />
        )}
      </div>
    </div>
  );
}
