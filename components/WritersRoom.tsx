"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PERSONAS, getAgentsForRoom, ROOM_TYPE_CONFIG, parseMentions } from "@/lib/personas";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Message, Room, PersonaId, Artifact, SpotifyTone } from "@/types";
import type { ReviewScope } from "@/lib/review-mode";

// ── Design tokens (Claude Design handoff — v2) ───────────────────────────────
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

type Screen = "empty" | "chat" | "roles";
type Modal  = "command" | "clear" | "artifacts" | "tone" | "notebooklm" | "review" | null;
type AgentId = string;

// AGENTS is populated dynamically from room type — set after Props are known
// Fallback to writers room agents for any static references
const DEFAULT_AGENTS = getAgentsForRoom("writers");
const getAgent = (id: string, agents?: typeof DEFAULT_AGENTS) =>
  (agents ?? DEFAULT_AGENTS).find(a => a.id === id) ?? DEFAULT_AGENTS[0];

interface Props {
  room: Room;
  currentUser: { id: string; name: string; image: string | null };
  userRole: "owner" | "member";
  reviewScope: ReviewScope | null;
  hasCalendarAccess: boolean;
}

// ── Sub-components ───────────────────────────────────────────────────────────

// Delete button shown on message hover
function DelBtn({ onClick }: { onClick: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div style={{
        position:"absolute", top:6, right:6, zIndex:10,
        display:"flex", alignItems:"center", gap:4,
        background:T.surf2, border:`1px solid ${T.bdr2}`,
        borderRadius:4, padding:"3px 8px",
        boxShadow:"0 4px 16px #000a",
      }}>
        <span style={{ fontFamily:T.mono, fontSize:9, color:T.meta, marginRight:2 }}>delete?</span>
        <button
          onClick={() => setConfirming(false)}
          style={{ background:"none", border:`1px solid ${T.bdr2}`, borderRadius:3,
            cursor:"pointer", color:T.sub, padding:"1px 8px",
            fontFamily:T.mono, fontSize:9, lineHeight:1.4 }}>no</button>
        <button
          onClick={() => { setConfirming(false); onClick(); }}
          style={{ background:"#ff5a5a18", border:"1px solid #ff5a5a55", borderRadius:3,
            cursor:"pointer", color:"#ff5a5a", padding:"1px 8px",
            fontFamily:T.mono, fontSize:9, lineHeight:1.4 }}>yes</button>
      </div>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} title="Delete message" style={{
      position:"absolute", top:6, right:6, zIndex:5,
      background:T.surf2, border:`1px solid ${T.bdr2}`,
      borderRadius:4, cursor:"pointer", color:T.sub,
      padding:"2px 7px", fontFamily:T.mono, fontSize:11, lineHeight:1.2,
    }}>×</button>
  );
}

// Copy button — shows next to delete on hover
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} title="Copy message" style={{
      position:"absolute", top:6, right:34, zIndex:5,
      background:T.surf2, border:`1px solid ${T.bdr2}`,
      borderRadius:4, cursor:"pointer",
      color: copied ? "#0fe898" : T.sub,
      padding:"2px 7px", fontFamily:T.mono, fontSize:11, lineHeight:1.2,
      transition:"color 0.2s",
    }}>{copied ? "✓" : "⎘"}</button>
  );
}

// Minimize / expand button — collapses message body to just the header
function MinBtn({ collapsed, onClick, rightOffset = 62 }: { collapsed: boolean; onClick: () => void; rightOffset?: number }) {
  return (
    <button onClick={onClick} title={collapsed ? "Expand message" : "Minimize message"} style={{
      position:"absolute", top:6, right:rightOffset, zIndex:5,
      background:T.surf2, border:`1px solid ${T.bdr2}`,
      borderRadius:4, cursor:"pointer", color:T.sub,
      padding:"2px 7px", fontFamily:T.mono, fontSize:11, lineHeight:1.2,
      transition:"color 0.15s",
    }}>{collapsed ? "▸" : "▾"}</button>
  );
}

// Reaction bar — three emoji, shown on hover for agent messages
const REACTIONS = ["👍", "💡", "⭐"] as const;
type Emoji = typeof REACTIONS[number];

function ReactBar({ msgId, active, onReact }: {
  msgId: string;
  active: string[];
  onReact: (msgId: string, emoji: string) => void;
}) {
  const REACT_META: Record<string, { label: string; title: string }> = {
    "👍": { label: "useful",     title: "Mark as useful" },
    "💡": { label: "insight",    title: "Key insight — worth remembering" },
    "⭐": { label: "direction",  title: "Save as direction (pins to top)" },
  };

  return (
    <div style={{ display:"flex", gap:4, marginTop:10 }}>
      {REACTIONS.map(emoji => {
        const isActive = active.includes(emoji);
        const meta = REACT_META[emoji];
        return (
          <button
            key={emoji}
            onClick={() => onReact(msgId, emoji)}
            title={meta.title}
            style={{
              background: isActive ? "rgba(255,255,255,0.08)" : "none",
              border: `1px solid ${isActive ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)"}`,
              borderRadius:6, padding:"3px 8px",
              fontSize:13, cursor:"pointer",
              opacity: isActive ? 1 : 0.45,
              transition:"all 0.15s",
              display:"flex", alignItems:"center", gap:4,
            }}>
            <span>{emoji}</span>
            <span style={{ fontFamily:T.mono, fontSize:8, color: isActive ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)" }}>
              {meta.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Reaction badges — always-visible when any reactions active
function ReactBadges({ active }: { active: string[] }) {
  if (!active.length) return null;
  const counts: Record<string, number> = {};
  active.forEach(e => { counts[e] = (counts[e] ?? 0) + 1; });
  return (
    <div style={{ display:"flex", gap:4, marginTop:8 }}>
      {Object.entries(counts).map(([emoji, count]) => (
        <span key={emoji} style={{
          fontSize:11, padding:"2px 7px",
          background:"rgba(255,255,255,0.05)",
          border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:99, color:"rgba(255,255,255,0.6)",
        }}>{emoji} {count > 1 ? count : ""}</span>
      ))}
    </div>
  );
}

// User message
function UserMessage({ msg, onDelete, collapsed, onToggleCollapse }: {
  msg: Message;
  onDelete: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: (id: string) => void;
}) {
  const [hov, setHov] = useState(false);
  const preview = msg.content.slice(0, 72) + (msg.content.length > 72 ? "…" : "");

  if (collapsed) {
    return (
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display:"flex", justifyContent:"flex-end", marginBottom:8, position:"relative" }}>
        <MinBtn collapsed={true} onClick={() => onToggleCollapse(msg.id)} rightOffset={6} />
        <div style={{
          maxWidth:"62%", background:T.surf, border:`1px solid ${T.bdr}`,
          borderRadius:8, padding:"6px 38px 6px 12px",
          display:"flex", alignItems:"center", gap:8, opacity:0.6,
        }}>
          <span style={{ fontFamily:T.sans, fontSize:12, color:"#686868" }}>{preview}</span>
        </div>
      </div>
    );
  }

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display:"flex", justifyContent:"flex-end", marginBottom:24, position:"relative" }}>
      {hov && <DelBtn onClick={() => onDelete(msg.id)} />}
      {hov && <CopyBtn text={msg.content} />}
      {hov && <MinBtn collapsed={false} onClick={() => onToggleCollapse(msg.id)} />}
      <div style={{
        maxWidth:"62%", background:T.surf, border:`1px solid ${T.bdr}`,
        borderRadius:8, padding:"10px 14px",
        fontFamily:T.sans, fontSize:14, color:"#686868", lineHeight:1.65,
        whiteSpace:"pre-wrap",
      }}>
        {msg.content}
        {hov && (
          <div style={{ fontSize:10, color:T.meta, marginTop:4, textAlign:"right", fontFamily:T.mono }}>
            {new Date(msg.created_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
          </div>
        )}
      </div>
    </div>
  );
}

// Agent message — unique treatment per role
function AgentMessage({ msg, onDelete, reactions, onReact, agents, collapsed, onToggleCollapse }: {
  msg: Message;
  onDelete: (id: string) => void;
  reactions: string[];
  onReact: (msgId: string, emoji: string) => void;
  agents: ReturnType<typeof getAgentsForRoom>;
  collapsed: boolean;
  onToggleCollapse: (id: string) => void;
}) {
  const [hov, setHov] = useState(false);
  const a = getAgent(msg.persona!, agents);
  const isCritic   = msg.persona === "critic";
  const isWriter   = msg.persona === "writer";
  const isEditor   = msg.persona === "editor";
  const isResearch = msg.persona === "researcher" || msg.persona === "intel" || msg.persona === "analyst" || msg.persona === "reader";

  const voiceLabel = isResearch ? "RESEARCH NOTE" : isWriter ? "DRAFT" : isEditor ? "REVISION" : isCritic ? "CHALLENGE" : "RESPONSE";
  const ts = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (collapsed) {
    return (
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{
          marginBottom: 8, position: "relative",
          marginLeft: isCritic ? 56 : 0,
          background: a.color + "0a", padding: "8px 14px",
          borderLeft: `3px solid ${a.color}`,
          opacity: 0.65,
        }}>
        <MinBtn collapsed={true} onClick={() => onToggleCollapse(msg.id)} rightOffset={6} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 32 }}>
          <span style={{ fontSize: 13, color: a.color }}>{a.icon}</span>
          <span style={{ fontFamily: T.mono, fontSize: 9, color: a.color, letterSpacing: "0.04em" }}>@{a.id}</span>
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta, letterSpacing: "0.1em" }}>{voiceLabel}</span>
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta, marginLeft: "auto" }}>minimized</span>
        </div>
      </div>
    );
  }

  // ── WRITER — manuscript: serif italic, generous leading ──────────────────
  if (isWriter) {
    return (
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ marginBottom: 28, position: "relative" }}>
        {hov && <DelBtn onClick={() => onDelete(msg.id)} />}
        {hov && <CopyBtn text={msg.content} />}
        {hov && <MinBtn collapsed={false} onClick={() => onToggleCollapse(msg.id)} />}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: a.color }}>{a.icon}</span>
          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: a.color, letterSpacing: "0.04em" }}>@{a.id}</span>
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta, letterSpacing: "0.1em" }}>DRAFT</span>
          <div style={{ flex: 1, height: 1, background: a.color + "22" }} />
          {hov && <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta }}>{ts}</span>}
        </div>
        <div style={{
          position: "relative",
          padding: "22px 28px 22px 36px",
          borderLeft: `2px solid ${a.color}`,
          background: a.color + "07",
        }}>
          {/* Manuscript margin mark */}
          <div style={{ position: "absolute", left: 12, top: 22, fontFamily: T.mono, fontSize: 8, color: a.color + "55", letterSpacing: "0.1em", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>DRAFT</div>
          <div style={{
            fontFamily: T.italic, fontSize: 17, lineHeight: 1.9,
            color: T.text, fontStyle: "italic", whiteSpace: "pre-wrap",
            letterSpacing: "-0.005em",
          }}>{msg.content}</div>
        </div>
        <ReactBadges active={reactions} />
        {hov && <ReactBar msgId={msg.id} active={reactions} onReact={onReact} />}
      </div>
    );
  }

  // ── RESEARCHER — research note: monospace, source rail ──────────────────
  if (isResearch) {
    return (
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ marginBottom: 28, position: "relative" }}>
        {hov && <DelBtn onClick={() => onDelete(msg.id)} />}
        {hov && <CopyBtn text={msg.content} />}
        {hov && <MinBtn collapsed={false} onClick={() => onToggleCollapse(msg.id)} />}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 14, color: a.color }}>{a.icon}</span>
          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: a.color, letterSpacing: "0.04em" }}>@{a.id}</span>
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta, letterSpacing: "0.1em" }}>RESEARCH NOTE</span>
          <div style={{ flex: 1, height: 1, background: a.color + "22" }} />
          {hov && <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta }}>{ts}</span>}
        </div>
        <div style={{
          border: `1px solid ${a.color}33`,
          borderLeft: `3px solid ${a.color}`,
          background: a.color + "07",
          borderRadius: "0 6px 6px 0",
          padding: "14px 18px",
        }}>
          <div style={{
            fontFamily: T.mono, fontSize: 13, lineHeight: 1.6,
            color: T.body, whiteSpace: "pre-wrap",
          }}>{msg.content}</div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${a.color}22`, fontFamily: T.mono, fontSize: 9, color: a.color + "88", letterSpacing: "0.1em" }}>
            SOURCES CITED · FACT-CHECKED
          </div>
        </div>
        <ReactBadges active={reactions} />
        {hov && <ReactBar msgId={msg.id} active={reactions} onReact={onReact} />}
      </div>
    );
  }

  // ── EDITOR — redline: before/after track-changes treatment ──────────────
  if (isEditor) {
    // Try to detect before/after blocks in content; else render as plain with edit styling
    const lines = msg.content.split("\n");
    const hasBefore = lines.some(l => /^(before:|original:)/i.test(l.trim()));
    return (
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ marginBottom: 28, position: "relative" }}>
        {hov && <DelBtn onClick={() => onDelete(msg.id)} />}
        {hov && <CopyBtn text={msg.content} />}
        {hov && <MinBtn collapsed={false} onClick={() => onToggleCollapse(msg.id)} />}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 14, color: a.color }}>{a.icon}</span>
          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: a.color, letterSpacing: "0.04em" }}>@{a.id}</span>
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta, letterSpacing: "0.1em" }}>REVISION</span>
          <div style={{ flex: 1, height: 1, background: a.color + "22" }} />
          {hov && <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta }}>{ts}</span>}
        </div>
        <div style={{
          border: `1px solid ${a.color}30`,
          borderLeft: `3px solid ${a.color}`,
          background: a.color + "07",
          borderRadius: "0 6px 6px 0",
          padding: "14px 18px",
        }}>
          <div style={{
            fontFamily: T.sans, fontSize: 14, lineHeight: 1.75,
            color: T.text, whiteSpace: "pre-wrap",
          }}>{msg.content}</div>
        </div>
        <ReactBadges active={reactions} />
        {hov && <ReactBar msgId={msg.id} active={reactions} onReact={onReact} />}
      </div>
    );
  }

  // ── CRITIC — dissent: dashed border, indented, numbered feel ────────────
  if (isCritic) {
    return (
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ marginBottom: 28, position: "relative", marginLeft: 56 }}>
        {hov && <DelBtn onClick={() => onDelete(msg.id)} />}
        {hov && <CopyBtn text={msg.content} />}
        {hov && <MinBtn collapsed={false} onClick={() => onToggleCollapse(msg.id)} />}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 14, color: a.color }}>{a.icon}</span>
          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: a.color, letterSpacing: "0.04em" }}>@{a.id}</span>
          <span style={{ fontFamily: T.mono, fontSize: 8, color: a.color + "88", letterSpacing: "0.1em" }}>CHALLENGE</span>
          <span style={{ fontFamily: T.mono, fontSize: 8, color: a.color + "66", marginLeft: 4 }}>dissent</span>
          <div style={{ flex: 1, height: 1, background: a.color + "22" }} />
          {hov && <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta }}>{ts}</span>}
        </div>
        <div style={{
          border: `1.5px dashed ${a.color}66`,
          borderLeft: `3px solid ${a.color}`,
          background: a.color + "09",
          borderRadius: "0 4px 4px 0",
          padding: "14px 20px",
        }}>
          <div style={{
            fontFamily: T.sans, fontSize: 14, lineHeight: 1.75,
            color: T.body, whiteSpace: "pre-wrap",
          }}>{msg.content}</div>
        </div>
        <ReactBadges active={reactions} />
        {hov && <ReactBar msgId={msg.id} active={reactions} onReact={onReact} />}
      </div>
    );
  }

  // ── DEFAULT — any other agent ────────────────────────────────────────────
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ marginBottom: 28, position: "relative" }}>
      {hov && <DelBtn onClick={() => onDelete(msg.id)} />}
      {hov && <CopyBtn text={msg.content} />}
      {hov && <MinBtn collapsed={false} onClick={() => onToggleCollapse(msg.id)} />}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14, color: a.color }}>{a.icon}</span>
        <span style={{ fontFamily: T.mono, fontSize: 9.5, color: a.color, letterSpacing: "0.04em" }}>@{a.id}</span>
        <div style={{ flex: 1, height: 1, background: a.color + "22" }} />
        {hov && <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta }}>{ts}</span>}
      </div>
      <div style={{
        borderLeft: `3px solid ${a.color}`,
        background: a.color + "0a",
        padding: "14px 18px",
        fontFamily: T.sans, fontSize: 14, lineHeight: 1.75,
        color: T.body, whiteSpace: "pre-wrap",
      }}>{msg.content}</div>
      <ReactBadges active={reactions} />
      {hov && <ReactBar msgId={msg.id} active={reactions} onReact={onReact} />}
    </div>
  );
}

// Director — full-bleed synthesis treatment
function DirectorMessage({ msg, onDelete, onSave, onContinue, canSave, reactions, onReact, onCallChain, agents, collapsed, onToggleCollapse }: {
  msg: Message;
  onDelete: (id: string) => void;
  onSave: (text: string) => void;
  onContinue: (text: string) => void;
  canSave: boolean;
  reactions: string[];
  onReact: (msgId: string, emoji: string) => void;
  onCallChain: (agentIds: string[], directorSynthesis: string) => void;
  agents: ReturnType<typeof getAgentsForRoom>;
  collapsed: boolean;
  onToggleCollapse: (id: string) => void;
}) {
  const [hov, setHov]     = useState(false);
  const [saved, setSaved]   = useState(false);
  const [calling, setCalling] = useState(false);
  const a = getAgent("director", agents);

  // Parse @mentions from the last "Next move:" line only
  const lines = msg.content.trimEnd().split("\n");
  const lastLine = lines[lines.length - 1] ?? "";
  const isNextMove = /next move:/i.test(lastLine);
  const nextMoveHandles: string[] = [];
  if (isNextMove) {
    const handles = agents.map(ag => ag.handle);
    const re = new RegExp(`@(${handles.join("|")})`, "gi");
    let m;
    while ((m = re.exec(lastLine)) !== null) {
      const h = m[1].toLowerCase();
      if (!nextMoveHandles.includes(h)) nextMoveHandles.push(h);
    }
  }

  // Body without the last line (we render it separately)
  const bodyContent = isNextMove && nextMoveHandles.length > 0
    ? lines.slice(0, -1).join("\n")
    : msg.content;

  const handleSave = () => {
    if (!canSave) return;
    onSave(msg.content);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const handleCallChain = async () => {
    if (calling || !nextMoveHandles.length) return;
    setCalling(true);
    await onCallChain(nextMoveHandles, msg.content);
    setCalling(false);
  };

  if (collapsed) {
    return (
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{
          margin:"8px -24px", padding:"10px 40px",
          background:a.color+"0a",
          borderTop:`1px solid ${a.color}28`, borderBottom:`1px solid ${a.color}18`,
          position:"relative", opacity:0.65,
        }}>
        <MinBtn collapsed={true} onClick={() => onToggleCollapse(msg.id)} rightOffset={6} />
        <div style={{ display:"flex", alignItems:"center", gap:10, paddingRight:32 }}>
          <span style={{ fontSize:15, color:a.color }}>◎</span>
          <span style={{ fontFamily:T.mono, fontSize:10, color:a.color }}>@director</span>
          <span style={{ fontFamily:T.mono, fontSize:8, color:T.meta, marginLeft:4 }}>SYNTHESIS</span>
          <span style={{ fontFamily:T.mono, fontSize:8, color:T.meta, marginLeft:"auto" }}>minimized</span>
        </div>
      </div>
    );
  }

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        margin:"32px -24px", padding:"22px 40px",
        background:a.color+"12",
        borderTop:`1px solid ${a.color}44`, borderBottom:`1px solid ${a.color}28`,
        position:"relative",
      }}>
      {hov && <DelBtn onClick={() => onDelete(msg.id)} />}
      {hov && <CopyBtn text={msg.content} />}
      {hov && <MinBtn collapsed={false} onClick={() => onToggleCollapse(msg.id)} />}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <span style={{ fontSize:18, color:a.color }}>◎</span>
        <span style={{ fontFamily:T.mono, fontSize:10, color:a.color, letterSpacing:"0.06em" }}>@director</span>
        <span style={{ fontFamily:T.mono, fontSize:8, color:T.meta, marginLeft:6 }}>SYNTHESIS</span>
        <div style={{ flex:1, height:1, background:a.color+"16", marginLeft:8 }} />
        {hov && <span style={{ fontFamily:T.mono, fontSize:8, color:T.meta }}>
          {new Date(msg.created_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
        </span>}
      </div>

      {/* Main body — last line separated out */}
      <div style={{ fontFamily: T.serif, fontSize: 20, lineHeight: 1.65, color: T.text, maxWidth: 640, whiteSpace: "pre-wrap", letterSpacing: "-0.005em" }}>
        {bodyContent}
      </div>

      {/* Next move line — rendered as interactive chain button */}
      {isNextMove && nextMoveHandles.length > 0 && (
        <div style={{
          marginTop:16, paddingTop:14,
          borderTop:`1px solid ${a.color}22`,
          display:"flex", alignItems:"center", gap:10,
        }}>
          <span style={{ fontFamily:T.mono, fontSize:8, color:a.color+"88", letterSpacing:"0.1em", flexShrink:0 }}>
            NEXT MOVE
          </span>
          <button
            onClick={handleCallChain}
            disabled={calling}
            title={`Fire ${nextMoveHandles.map(h => "@" + h).join(" → ")} as a chain`}
            style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"5px 12px",
              background: calling ? a.color+"22" : a.color+"14",
              border:`1px solid ${calling ? a.color+"88" : a.color+"44"}`,
              borderRadius:6, cursor: calling ? "not-allowed" : "pointer",
              transition:"all 0.2s",
            }}
          >
            {calling ? (
              <span style={{ fontFamily:T.mono, fontSize:10, color:a.color }}>calling…</span>
            ) : (
              nextMoveHandles.map((handle, i) => {
                const ag = agents.find(x => x.handle === handle);
                return (
                  <span key={handle} style={{ display:"flex", alignItems:"center", gap:4 }}>
                    {i > 0 && <span style={{ fontFamily:T.mono, fontSize:9, color:a.color+"66" }}>→</span>}
                    <span style={{ fontSize:12, color: ag?.color ?? T.sub }}>{ag?.icon ?? "◉"}</span>
                    <span style={{ fontFamily:T.mono, fontSize:9, color: ag?.color ?? T.sub }}>@{handle}</span>
                  </span>
                );
              })
            )}
            {!calling && (
              <span style={{ fontFamily:T.mono, fontSize:8, color:a.color+"55", marginLeft:2 }}>↑</span>
            )}
          </button>
        </div>
      )}

      {/* Action row */}
      <div style={{ display:"flex", gap:10, marginTop:14 }}>
        <button
          onClick={handleSave}
          disabled={!canSave}
          title={!canSave ? "5 directions saved" : "Pin this synthesis"}
          style={{
            background: saved ? "#c89cff22" : "none",
            border: `1px solid ${saved ? "#c89cff88" : T.bdr2}`,
            borderRadius:4, padding:"5px 14px",
            fontFamily:T.mono, fontSize:9,
            color: saved ? "#c89cff" : T.sub,
            cursor: canSave ? "pointer" : "not-allowed",
            opacity: canSave ? 1 : 0.35,
            transition:"all 0.2s",
          }}
        >{saved ? "saved ✓" : "save as direction →"}</button>
        <button
          onClick={() => onContinue(msg.content)}
          style={{
            background:"none", border:`1px solid ${T.bdr2}`, borderRadius:4,
            padding:"5px 14px", fontFamily:T.mono, fontSize:9, color:T.sub, cursor:"pointer",
          }}
        >continue</button>
      </div>
      <ReactBadges active={reactions} />
      {hov && <ReactBar msgId={msg.id} active={reactions} onReact={onReact} />}
    </div>
  );
}

// Message router
function MsgComponent({ msg, onDelete, onSave, onContinue, canSave, reactions, onReact, onCallChain, agents, collapsed, onToggleCollapse }: {
  msg: Message;
  onDelete: (id: string) => void;
  onSave: (text: string) => void;
  onContinue: (text: string) => void;
  canSave: boolean;
  reactions: string[];
  onReact: (msgId: string, emoji: string) => void;
  onCallChain: (agentIds: string[], directorSynthesis: string) => void;
  agents: ReturnType<typeof getAgentsForRoom>;
  collapsed: boolean;
  onToggleCollapse: (id: string) => void;
}) {
  if (msg.role === "user") return <UserMessage msg={msg} onDelete={onDelete} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />;
  if (msg.persona === "director") return <DirectorMessage msg={msg} onDelete={onDelete} onSave={onSave} onContinue={onContinue} canSave={canSave} reactions={reactions} onReact={onReact} onCallChain={onCallChain} agents={agents} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />;
  if (msg.persona) return <AgentMessage msg={msg} onDelete={onDelete} reactions={reactions} onReact={onReact} agents={agents} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />;
  return null;
}

// Directions panel — pinned strip above chat (horizontal, like the design artboard)
function DirectionsPanel({ directions, onRemove }: { directions: string[]; onRemove: (i: number) => void }) {
  if (!directions.length) return null;
  const dirColor = "#c89cff";
  return (
    <div style={{
      background: T.bg2, borderBottom: `1px solid ${T.bdr}`,
      padding: "9px 32px 8px", flexShrink: 0,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{ fontFamily: T.mono, fontSize: 8, color: dirColor, letterSpacing: "0.14em", whiteSpace: "nowrap" }}>★ DIRECTIONS</span>
      <div style={{ width: 1, height: 14, background: dirColor + "33" }} />
      <div style={{ display: "flex", gap: 6, flex: 1, overflow: "hidden" }}>
        {directions.map((d, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 8px 4px 9px",
            background: dirColor + "0f",
            border: `1px solid ${dirColor}33`,
            borderRadius: 4,
            fontSize: 11, color: T.body,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            flex: "0 1 auto", maxWidth: 280,
          }}>
            <span style={{ color: dirColor, fontSize: 10, flexShrink: 0 }}>◎</span>
            <span style={{ fontFamily: T.italic, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis" }}>{d}</span>
            <button onClick={() => onRemove(i)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: T.meta, fontSize: 12, lineHeight: 1, padding: "0 0 0 4px", flexShrink: 0,
            }}>×</button>
          </div>
        ))}
      </div>
      <span style={{ fontFamily: T.mono, fontSize: 8, color: T.meta, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>injected into every call</span>
    </div>
  );
}

// Floating draggable dock (desktop)
function FloatingDock({ onMention, onChain, agentCtx, agents }: { onMention: (id: string) => void; onChain: (id: string) => void; agentCtx: Record<string, string>; agents: ReturnType<typeof getAgentsForRoom> }) {
  const [pos, setPos]   = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [hov, setHov]   = useState<string | null>(null);
  const ref    = useRef<HTMLDivElement>(null);
  const dstart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const onPDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === "BUTTON" || t.tagName === "SPAN") return;
    const r = ref.current!.getBoundingClientRect();
    dstart.current = { mx: e.clientX, my: e.clientY, ox: r.left, oy: r.top };
    setDrag(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!drag) return;
    const mv = (e: PointerEvent) => {
      const dx = e.clientX - dstart.current!.mx;
      const dy = e.clientY - dstart.current!.my;
      setPos({ x: dstart.current!.ox + dx, y: dstart.current!.oy + dy });
    };
    const up = () => setDrag(false);
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
  }, [drag]);

  const posStyle = pos
    ? { left: pos.x, top: pos.y, right: "auto", transform: "none" }
    : { right: 24, top: "50%", transform: "translateY(-50%)" };

  return (
    <div ref={ref} onPointerDown={onPDown} style={{
      position:"fixed", zIndex:100,
      background:T.surf2, border:`1px solid ${T.bdr2}`,
      borderRadius:14, padding:"6px 8px 10px",
      display:"flex", flexDirection:"column", gap:6,
      cursor: drag ? "grabbing" : "default",
      boxShadow:"0 8px 40px #00000099",
      userSelect:"none",
      ...posStyle,
    } as React.CSSProperties}>
      <div style={{ height:14, display:"flex", alignItems:"center", justifyContent:"center", cursor:"grab" }}>
        <div style={{ width:22, height:3, background:T.bdr2, borderRadius:99 }} />
      </div>
      {agents.map(a => (
        <div key={a.id} style={{ position:"relative" }}
          onMouseEnter={() => setHov(a.id)} onMouseLeave={() => setHov(null)}>
          {hov === a.id && (
            <div style={{
              position:"absolute", right:"calc(100% + 12px)", top:"50%",
              transform:"translateY(-50%)",
              width:210, background:T.surf2,
              border:`1.5px solid ${a.color}44`, borderRadius:10,
              padding:"12px 14px", pointerEvents:"none",
              boxShadow:"0 4px 28px #00000099", zIndex:200,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:7 }}>
                <span style={{ fontSize:17, color:a.color }}>{a.icon}</span>
                <span style={{ fontFamily:T.mono, fontSize:10, color:a.color }}>@{a.id}</span>
              </div>
              <div style={{ fontFamily:T.mono, fontSize:8, color:T.sub, lineHeight:1.7 }}>{a.role}</div>
              {agentCtx[a.id] && (
                <div style={{ fontFamily:T.sans, fontSize:11, color:T.sub, lineHeight:1.5, borderTop:`1px solid ${T.bdr}`, paddingTop:8, marginTop:8 }}>
                  {agentCtx[a.id]}
                </div>
              )}
              <div style={{ fontFamily:T.sans, fontSize:11, color:a.color+"99", marginTop:8, fontStyle:"italic" }}>
                {a.tagline}
              </div>
            </div>
          )}
          <div style={{ display:"flex", gap:3 }}>
            {/* @ parallel */}
            <button onClick={() => onMention(a.id)} title={`@${a.id} (parallel)`} style={{
              width:40, height:48, background:a.color+"16",
              border:`1.5px solid ${a.color}55`, borderRadius:"8px 0 0 8px",
              display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", gap:2, cursor:"pointer",
            }}>
              <span style={{ fontSize:17, color:a.color }}>{a.icon}</span>
              <span style={{ fontFamily:T.mono, fontSize:6, color:a.color+"99" }}>@{a.id.slice(0,3)}</span>
            </button>
            {/* → chain */}
            <button onClick={() => onChain(a.id)} title={`→ @${a.id} (chain — reacts to previous)`} style={{
              width:18, height:48, background:a.color+"0a",
              border:`1.5px solid ${a.color}33`, borderLeft:"none", borderRadius:"0 8px 8px 0",
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", padding:0,
            }}>
              <span style={{ fontSize:9, color:a.color+"88", fontFamily:T.mono }}>→</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Notes Panel — collapsible side panel for shared room notes
function NotesPanel({ notes, onChange, saving, onClose }: {
  notes: string;
  onChange: (v: string) => void;
  saving: "idle" | "saving" | "saved";
  onClose: () => void;
}) {
  return (
    <div style={{
      width:"30%", minWidth:240, maxWidth:420,
      background:T.surf, borderLeft:`1px solid ${T.bdr}`,
      display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden",
    }}>
      <div style={{
        height:48, padding:"0 16px",
        display:"flex", alignItems:"center", gap:8, flexShrink:0,
        borderBottom:`1px solid ${T.bdr}`,
      }}>
        <span style={{ fontFamily:T.mono, fontSize:9, color:T.sub, letterSpacing:"0.14em", flex:1 }}>
          📝 ROOM NOTES
        </span>
        <span style={{
          fontFamily:T.mono, fontSize:8,
          color: saving==="saving"?"#f97316" : saving==="saved"?"#0fe898" : T.meta,
          transition:"color 0.3s",
        }}>
          {saving==="saving" ? "SAVING…" : saving==="saved" ? "SAVED ✓" : "AUTO-SAVES"}
        </span>
        <button onClick={onClose} style={{
          background:"none", border:"none", color:T.meta, cursor:"pointer",
          fontSize:18, lineHeight:1, padding:"0 0 0 8px",
        }}>×</button>
      </div>
      <textarea
        value={notes}
        onChange={e => onChange(e.target.value)}
        placeholder={"Shared notes for this room.\nCapture ideas, decisions, context…\n\nAuto-saved every 2 seconds.\nVisible to all room members."}
        style={{
          flex:1, background:"transparent", border:"none", outline:"none",
          resize:"none", padding:"16px",
          fontFamily:T.sans, fontSize:13, color:T.text, lineHeight:1.75,
        }}
      />
      <div style={{
        padding:"8px 16px", borderTop:`1px solid ${T.bdr}`, flexShrink:0,
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <span style={{ fontFamily:T.mono, fontSize:8, color:T.meta }}>{notes.length} chars</span>
        <span style={{ fontFamily:T.mono, fontSize:8, color:T.meta }}>shared · all members</span>
      </div>
    </div>
  );
}

// Command palette
function CommandPalette({ onClose, onScreen, onClear, onDemo, onModal, onExport }: {
  onClose: () => void;
  onScreen: (s: Screen) => void;
  onClear: () => void;
  onDemo: () => void;
  onModal: (m: Modal) => void;
  onExport: () => void;
}) {
  const items = [
    { icon:"⚙",  label:"Configure roles",         sub:"add context for each agent",       fn: () => { onScreen("roles"); onClose(); } },
    { icon:"▶",  label:"Load demo conversation",   sub:"slow journalism example",           fn: () => { onDemo(); onClose(); } },
    { icon:"⤴",  label:"Export session as .md",    sub:"download full chat log + artifacts", fn: () => { onExport(); onClose(); } },
    { icon:"◈",  label:"Manage artifacts",         sub:"upload reference files for RAG",    fn: () => { onModal("artifacts"); onClose(); } },
    { icon:"🎵", label:"Set section tone",         sub:"extract mood from Spotify track",   fn: () => { onModal("tone"); onClose(); } },
    { icon:"◎",  label:"NotebookLM bridge",        sub:"link notebook & export Lore Pack",  fn: () => { onModal("notebooklm"); onClose(); } },
    { icon:"⊡",  label:"Share review link",        sub:"read-only link, expires in 72h",   fn: () => { onModal("review"); onClose(); } },
    { icon:"⌫",  label:"Clear conversation",       sub:"delete all messages",               fn: () => { onClear(); onClose(); } },
  ];

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"#000000bb", zIndex:500,
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:460, background:T.surf2, border:`1.5px solid ${T.bdr2}`,
        borderRadius:12, overflow:"hidden", boxShadow:"0 24px 64px #000",
      }}>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${T.bdr}`, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontFamily:T.mono, fontSize:11, color:T.sub }}>⌘K</span>
          <span style={{ fontFamily:T.mono, fontSize:9, color:T.meta, marginLeft:4 }}>COMMAND PALETTE</span>
          <span style={{ marginLeft:"auto", fontFamily:T.mono, fontSize:9, color:T.meta }}>ESC to close</span>
        </div>
        {items.map((item, i) => (
          <button key={i} onClick={item.fn} style={{
            width:"100%", background:"none", border:"none",
            borderBottom: i < items.length - 1 ? `1px solid ${T.bdr}` : "none",
            padding:"12px 18px", cursor:"pointer", textAlign:"left",
            display:"flex", alignItems:"center", gap:14,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = T.surf)}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}>
            <span style={{ fontSize:15, color:T.sub, width:22, textAlign:"center", flexShrink:0 }}>{item.icon}</span>
            <div>
              <div style={{ fontFamily:T.sans, fontSize:13, color:T.text, marginBottom:2 }}>{item.label}</div>
              <div style={{ fontFamily:T.mono, fontSize:8.5, color:T.meta }}>{item.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Clear confirmation modal
function ClearConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div onClick={onCancel} style={{
      position:"fixed", inset:0, background:"#000000bb", zIndex:500,
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:360, background:T.surf2, border:`1px solid ${T.bdr2}`,
        borderRadius:12, padding:"28px 24px", boxShadow:"0 24px 64px #000",
      }}>
        <div style={{ fontFamily:T.sans, fontSize:15, color:T.text, marginBottom:8, fontWeight:500 }}>
          Clear this conversation?
        </div>
        <div style={{ fontFamily:T.sans, fontSize:13, color:T.sub, marginBottom:28, lineHeight:1.6 }}>
          All messages will be deleted. The room goes back to empty.
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onCancel} style={{
            background:"none", border:`1px solid ${T.bdr2}`, borderRadius:6,
            padding:"8px 18px", fontFamily:T.sans, fontSize:13, color:T.sub, cursor:"pointer",
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            background:"#ff5a5a18", border:"1px solid #ff5a5a55", borderRadius:6,
            padding:"8px 18px", fontFamily:T.sans, fontSize:13, color:"#ff5a5a", cursor:"pointer",
          }}>Clear chat</button>
        </div>
      </div>
    </div>
  );
}

// Mobile agent bottom sheet
function AgentBottomSheet({ onMention, onClose, agents }: { onMention: (id: string) => void; onClose: () => void; agents: ReturnType<typeof getAgentsForRoom> }) {
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"#000000aa", zIndex:300,
      display:"flex", flexDirection:"column", justifyContent:"flex-end",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:T.surf2, borderRadius:"14px 14px 0 0",
        borderTop:`1px solid ${T.bdr2}`, paddingBottom:40,
      }}>
        <div style={{ width:36, height:4, background:T.bdr2, borderRadius:99, margin:"12px auto 18px" }} />
        <div style={{ fontFamily:T.mono, fontSize:9, color:T.meta, textAlign:"center", marginBottom:14, letterSpacing:"0.12em" }}>
          CALL AN AGENT
        </div>
        <div style={{ display:"flex", padding:"0 14px", gap:8 }}>
          {agents.map(a => (
            <button key={a.id} onClick={() => { onMention(a.id); onClose(); }} style={{
              flex:1, background:a.color+"16", border:`1px solid ${a.color}44`,
              borderRadius:10, padding:"12px 0",
              display:"flex", flexDirection:"column", alignItems:"center", gap:5, cursor:"pointer",
            }}>
              <span style={{ fontSize:22, color:a.color }}>{a.icon}</span>
              <span style={{ fontFamily:T.mono, fontSize:8, color:a.color+"aa" }}>@{a.id.slice(0,4)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Feature modal wrapper
function FeatureModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"#000000bb", zIndex:400,
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:480, background:T.surf2, border:`1px solid ${T.bdr2}`,
        borderRadius:12, overflow:"hidden", boxShadow:"0 24px 64px #000",
      }}>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${T.bdr}`, display:"flex", alignItems:"center" }}>
          <span style={{ fontFamily:T.mono, fontSize:10, color:T.sub, letterSpacing:"0.1em" }}>{title}</span>
          <button onClick={onClose} style={{ marginLeft:"auto", background:"none", border:"none", color:T.sub, cursor:"pointer", fontSize:18 }}>×</button>
        </div>
        <div style={{ padding:"20px" }}>{children}</div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function WritersRoom({ room: initialRoom, currentUser, reviewScope, hasCalendarAccess }: Props) {
  const isReadOnly = reviewScope !== null && !reviewScope?.write;
  const roomType = (initialRoom.room_type ?? "writers") as import("@/types").RoomType;
  const AGENTS = getAgentsForRoom(roomType);
  const roomConfig = ROOM_TYPE_CONFIG[roomType];
  const router = useRouter();
  const [screen, setScreen]   = useState<Screen>("empty");
  const [modal, setModal]     = useState<Modal>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [room, setRoom]       = useState(initialRoom);
  const [isMobile, setIsMobile] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [agentCtx, setAgentCtx] = useState<Record<string, string>>({});
  const [agentVoices, setAgentVoices] = useState<Record<string, { persona: string|null; genre: string|null; career: string|null }>>({});
  const [directions, setDirections] = useState<string[]>([]);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, string[]>>({});
  const [agentInspirations, setAgentInspirations] = useState<Record<string, string[]>>({});
  const [inspirationInputs, setInspirationInputs] = useState<Record<string, string>>({});

  // Feature state
  const [artifacts, setArtifacts]   = useState<Artifact[]>([]);
  const [uploadingArtifact, setUploadingArtifact] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [loadingTone, setLoadingTone] = useState(false);
  const [toneError, setToneError]   = useState("");
  const [notebooklmUrl, setNotebooklmUrl] = useState(room.notebooklm_url ?? "");
  const [savingNotebooklm, setSavingNotebooklm] = useState(false);
  const [reviewLink, setReviewLink] = useState("");
  const [generatingReview, setGeneratingReview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [responseLength, setResponseLength] = useState<"parsimonious" | "normal" | "verbose">("normal");
  const [pendingCalendarEvents, setPendingCalendarEvents] = useState<Array<{
    title: string; date?: string; duration: string; notes?: string; msgId: string;
  }>>([]);
  const [creatingEvents, setCreatingEvents] = useState<Set<number>>(new Set());
  const [createdEvents, setCreatedEvents] = useState<Set<number>>(new Set());

  // Notes panel
  const [notes, setNotes] = useState<string>(initialRoom.notes ?? "");
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesSaving, setNotesSaving] = useState<"idle"|"saving"|"saved">("idle");

  // Collapsed messages
  const [collapsedMsgs, setCollapsedMsgs] = useState<Set<string>>(new Set());
  const toggleCollapse = (id: string) => {
    setCollapsedMsgs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bottomRef   = useRef<HTMLDivElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track IDs added locally so Realtime subscription doesn't double-add them
  const seenIds   = useRef<Set<string>>(new Set());

  // Load history, artifacts, agent context on mount + Realtime subscription
  useEffect(() => {
    // Load message history
    fetch(`/api/messages?roomId=${room.id}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const msgs = data.map((m: any) => ({
            ...m,
            user_name: m.profiles?.name ?? "User",
            user_avatar: m.profiles?.avatar_url ?? null,
          }));
          // Seed seenIds with all existing message IDs
          msgs.forEach((m: Message) => seenIds.current.add(m.id));
          setMessages(msgs);
          setScreen("chat");
        }
      });

    fetch(`/api/artifacts?roomId=${room.id}`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setArtifacts(data));

    // Restore agent context, voices, and directions from localStorage
    try {
      const saved = localStorage.getItem(`wr-agent-ctx-${room.id}`);
      if (saved) setAgentCtx(JSON.parse(saved));
    } catch {}
    try {
      const savedVoices = localStorage.getItem(`wr-agent-voices-${room.id}`);
      if (savedVoices) setAgentVoices(JSON.parse(savedVoices));
    } catch {}
    try {
      const savedDirs = localStorage.getItem(`wr-directions-${room.id}`);
      if (savedDirs) setDirections(JSON.parse(savedDirs));
    } catch {}
    try {
      const savedInsp = localStorage.getItem(`wr-inspirations-${room.id}`);
      if (savedInsp) setAgentInspirations(JSON.parse(savedInsp));
    } catch {}
    try {
      const savedReacts = localStorage.getItem(`wr-reactions-${room.id}`);
      if (savedReacts) setMessageReactions(JSON.parse(savedReacts));
    } catch {}

    // Mobile detection
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);

    // ── Realtime subscription ──────────────────────────────────────────────
    // Receives messages inserted by OTHER users in this room.
    // We skip IDs already in seenIds (our own optimistic messages).
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`room-messages-${room.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const raw = payload.new as any;
          if (seenIds.current.has(raw.id)) return; // already added locally
          seenIds.current.add(raw.id);

          const incoming: Message = {
            id:         raw.id,
            role:       raw.role,
            persona:    raw.persona ?? undefined,
            content:    raw.content,
            user_id:    raw.user_id ?? undefined,
            user_name:  raw.user_id ? undefined : undefined, // resolved below if needed
            created_at: raw.created_at,
            citations:  raw.citations ?? undefined,
          };

          setMessages(prev => [...prev, incoming]);
          setScreen("chat");
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("resize", check);
      supabase.removeChannel(channel);
    };
  }, [room.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const AGENT_KEYS: Record<string, AgentId> = {
      "1": "researcher", "2": "writer", "3": "editor", "4": "critic", "5": "director",
    };

    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "TEXTAREA" || tag === "INPUT";

      // ⌘K — command palette (always)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setModal(m => m === "command" ? null : "command");
        return;
      }

      // Escape — close modal or clear input
      if (e.key === "Escape") {
        if (modal) { setModal(null); return; }
        if (inInput && input) { setInput(""); return; }
      }

      // Shortcuts that only fire when input is focused
      if (!inInput) return;

      // Tab — cycle to next agent mention
      if (e.key === "Tab" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const ids = AGENTS.map(a => a.id);
        // Find last @mention in current input to decide which agent comes next
        const lastMention = input.match(/@(\w+)\s*$/);
        const lastIdx = lastMention ? ids.indexOf(lastMention[1] as AgentId) : -1;
        const next = ids[(lastIdx + 1) % ids.length];
        // Replace trailing @mention or append
        const base = lastMention ? input.slice(0, input.lastIndexOf(`@${lastMention[1]}`)) : input;
        setInput(base + `@${next} `);
        return;
      }

      // ⌘1–5 — insert specific agent mention
      if ((e.metaKey || e.ctrlKey) && AGENT_KEYS[e.key]) {
        e.preventDefault();
        const id = AGENT_KEYS[e.key];
        setInput(prev => prev + `@${id} `);
        return;
      }
    };

    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [input, modal]);

  // Smart auto-scroll: only follow if already at bottom
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnreadCount(0);
    } else {
      // Count new agent messages as unread
      setUnreadCount(prev => prev + 1);
    }
  }, [messages]);

  // Always scroll on loading state change (typing indicator)
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [loading]);

  function now() { return new Date().toISOString(); }

  // Agent context update (save to localStorage)
  const updateAgentCtx = (agentId: string, value: string) => {
    const next = { ...agentCtx, [agentId]: value };
    setAgentCtx(next);
    try { localStorage.setItem(`wr-agent-ctx-${room.id}`, JSON.stringify(next)); } catch {}
  };

  // Voice picker update (save to localStorage)
  const updateAgentVoice = (agentId: string, category: "persona" | "genre" | "career", value: string | null) => {
    const current = agentVoices[agentId] ?? { persona: null, genre: null, career: null };
    const next = { ...agentVoices, [agentId]: { ...current, [category]: value } };
    setAgentVoices(next);
    try { localStorage.setItem(`wr-agent-voices-${room.id}`, JSON.stringify(next)); } catch {}
  };

  // Inspirations — add/remove reference items per agent (max 13)
  const addInspiration = (agentId: string, item: string) => {
    const current = agentInspirations[agentId] ?? [];
    if (!item.trim() || current.length >= 13) return;
    const next = { ...agentInspirations, [agentId]: [...current, item.trim()] };
    setAgentInspirations(next);
    setInspirationInputs(prev => ({ ...prev, [agentId]: "" }));
    try { localStorage.setItem(`wr-inspirations-${room.id}`, JSON.stringify(next)); } catch {}
  };

  const removeInspiration = (agentId: string, index: number) => {
    const current = agentInspirations[agentId] ?? [];
    const next = { ...agentInspirations, [agentId]: current.filter((_, i) => i !== index) };
    setAgentInspirations(next);
    try { localStorage.setItem(`wr-inspirations-${room.id}`, JSON.stringify(next)); } catch {}
  };

  // Toggle a reaction on a message; ⭐ also saves to directions
  const toggleReaction = (msgId: string, emoji: string) => {
    const current = messageReactions[msgId] ?? [];
    const isActive = current.includes(emoji);
    const next = {
      ...messageReactions,
      [msgId]: isActive ? current.filter(e => e !== emoji) : [...current, emoji],
    };
    setMessageReactions(next);
    try { localStorage.setItem(`wr-reactions-${room.id}`, JSON.stringify(next)); } catch {}

    // ⭐ feeds into directions
    if (emoji === "⭐" && !isActive) {
      const msg = messages.find(m => m.id === msgId);
      if (msg && directions.length < 5) saveDirection(msg.content);
    }
  };

  // Build the full composed system prompt for an agent (base + voice + context)
  const buildComposedPrompt = (agentId: string): string => {
    const persona = PERSONAS[agentId as PersonaId];
    if (!persona) return "";
    const parts: string[] = [persona.system];
    const v = agentVoices[agentId];
    if (v) {
      const voiceParts = [
        v.persona ? `Write in the style of ${v.persona}.` : null,
        v.genre   ? `Genre: ${v.genre}.`                  : null,
        v.career  ? `Perspective: ${v.career}.`           : null,
      ].filter(Boolean);
      if (voiceParts.length) parts.push("\nVOICE SETTINGS:\n" + voiceParts.join(" "));
    }
    const insp = agentInspirations[agentId];
    if (insp?.length) parts.push("\nINSPIRATIONS:\n" + insp.map(i => `- ${i}`).join("\n"));
    const ctx = agentCtx[agentId];
    if (ctx?.trim()) parts.push("\nUSER CONTEXT:\n" + ctx.trim());
    return parts.join("\n");
  };

  // Export all five composed prompts as a single .md file
  const exportAllPrompts = () => {
    const sections = AGENTS.map(a => {
      const prompt = buildComposedPrompt(a.id);
      return `## @${a.id} — ${a.name}\n\n\`\`\`\n${prompt}\n\`\`\``;
    }).join("\n\n---\n\n");
    const md = `# Writers Room — Agent System Prompts\nExported: ${new Date().toLocaleString()}\n\n---\n\n${sections}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "writers-room-prompts.md"; a.click();
    URL.revokeObjectURL(url);
  };

  // Directions
  const saveDirection = (text: string) => {
    if (directions.length >= 5) return;
    const next = [...directions, text];
    setDirections(next);
    try { localStorage.setItem(`wr-directions-${room.id}`, JSON.stringify(next)); } catch {}
  };

  const removeDirection = (index: number) => {
    const next = directions.filter((_, i) => i !== index);
    setDirections(next);
    try { localStorage.setItem(`wr-directions-${room.id}`, JSON.stringify(next)); } catch {}
  };

  const continueFromDirector = (directorText: string) => {
    setInput(`@writer continue from the director's direction`);
    inputRef.current?.focus();
  };

  // Notes — debounced save, 2 seconds after last keystroke
  const handleNotesChange = (value: string) => {
    setNotes(value);
    setNotesSaving("saving");
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    notesSaveTimer.current = setTimeout(async () => {
      await fetch(`/api/rooms/${room.id}`, {
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ notes: value }),
      });
      setNotesSaving("saved");
      setTimeout(() => setNotesSaving("idle"), 2000);
    }, 2000);
  };

  // Export — Google Drive for Google users, .md download for everyone else
  const handleExport = async () => {
    if (hasCalendarAccess) {
      try {
        const res = await fetch(`/api/rooms/${room.id}/export`, { method:"POST" });
        if (res.ok) {
          const ct = res.headers.get("content-type") ?? "";
          if (ct.includes("application/json")) {
            const data = await res.json();
            if (data.driveUrl) { window.open(data.driveUrl, "_blank"); return; }
          }
        }
      } catch { /* fall through to .md */ }
    }
    window.open(`/api/rooms/${room.id}/export`, "_blank");
  };

  // Insert chain arrow → @agent into input
  const insertChain = (id: string) => {
    setInput(prev => {
      const trimmed = prev.trimEnd();
      // If input already ends with a mention, append →
      const sep = trimmed ? " → " : "";
      return trimmed + sep + `@${id} `;
    });
    inputRef.current?.focus();
  };

  // Parse call syntax from user message:
  // "@researcher @writer"        → parallel: ["researcher","writer"]
  // "@researcher → @writer"      → chain: [["researcher","writer"]]
  // "@researcher @writer → @editor" → parallel researcher+writer, then chain editor
  // Returns: { mode: "parallel"|"chain", calls: AgentId[][] }
  // Each inner array is a sequential chain; parallel = multiple single-item arrays
  const parseCallSyntax = (text: string): { mode: "parallel"|"chain"; calls: AgentId[][] } => {
    // Split on → to detect chain segments
    const segments = text.split(/\s*→\s*/);
    if (segments.length > 1) {
      // Chain mode — each segment can have one or more agents
      // We take only the first agent from each segment for the chain
      const chains: AgentId[] = [];
      for (const seg of segments) {
        const handles = AGENTS.map(a => a.handle).join("|");
        const re = new RegExp(`@(${handles})`, "gi");
        let m;
        while ((m = re.exec(seg)) !== null) {
          const id = m[1].toLowerCase() as AgentId;
          if (!chains.includes(id)) chains.push(id);
        }
      }
      return { mode: "chain", calls: chains.map(id => [id]) };
    }
    // Parallel mode — all mentions fire independently
    const mentions = parseMentions(text, AGENTS) as AgentId[];
    return { mode: "parallel", calls: mentions.map(id => [id]) };
  };

  // Build per-agent agentContext string
  const buildAgentContext = (personaId: string): string | null => {
    return [
      agentInspirations[personaId]?.length
        ? "INSPIRATIONS:\n" + agentInspirations[personaId].map((i: string) => `- ${i}`).join("\n")
        : null,
      agentCtx[personaId] || null,
      (() => {
        const v = agentVoices[personaId];
        if (!v) return null;
        const parts = [
          v.persona ? `Write in the style of ${v.persona}.` : null,
          v.genre ? `Genre: ${v.genre}.` : null,
          v.career ? `Perspective: ${v.career}.` : null,
        ].filter(Boolean);
        return parts.length ? parts.join(' ') : null;
      })(),
    ].filter(Boolean).join(' ') || null;
  };

  // Fire a director-suggested chain — called when user clicks a Next move button
  const callDirectorChain = async (agentIds: string[], directorSynthesis: string) => {
    if (Object.keys(loading).length > 0) return;

    const newLoading: Record<string, boolean> = {};
    agentIds.forEach(id => { newLoading[id] = true; });
    setLoading(newLoading);

    // Base history for the chain — full room log
    const directionsBlock = directions.length > 0
      ? "PINNED DIRECTIONS:" + directions.map((d, i) => `${i + 1}. ${d}`).join("") : null;
    type HistoryMsg = { role: string; persona: string | undefined; content: string; user_name: string | undefined };
    const baseHistory: HistoryMsg[] = [...messages].map(m => ({
      role: m.role, persona: m.persona, content: m.content, user_name: m.user_name,
    }));
    if (directionsBlock) {
      baseHistory.unshift({ role: "system", persona: undefined, content: directionsBlock, user_name: undefined });
    }

    // Each agent fires as a chain — receives director synthesis + previous agent response (Option B)
    let previousResponse: string | null = directorSynthesis;
    let previousPersonaId: string | null = "director";

    for (const personaId of agentIds) {
      const chainHistory: HistoryMsg[] = previousResponse && previousPersonaId
        ? [...baseHistory, { role: "agent", persona: previousPersonaId, content: previousResponse, user_name: undefined }]
        : [...baseHistory];

      try {
        const agentRes: Response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personaId,
            // Specific prompt — agent knows it was called by the director
            userMessage: `The director has suggested you respond. Here is their synthesis and direction:

${directorSynthesis}`,
            roomId: room.id,
            history: chainHistory,
            chainContext: previousResponse,
            previousPersona: previousPersonaId,
            agentContext: buildAgentContext(personaId),
            lengthMultiplier: responseLength === "parsimonious" ? 0.4 : responseLength === "verbose" ? 1.8 : 1.0,
          }),
        });

        if (agentRes.status === 429) {
          const err = await agentRes.json();
          setRateLimitError(err.message ?? "Rate limit reached.");
          setLoading({});
          return;
        }

        const { text: agentText, id: agentId } = await agentRes.json();
        if (agentId) seenIds.current.add(agentId);

        const agentMsg: Message = {
          id: agentId ?? `${Date.now()}-${personaId}`,
          role: "agent", persona: personaId as PersonaId,
          content: agentText, created_at: now(),
        };
        setMessages(prev => [...prev, agentMsg]);
        if (personaId === "scheduler") parseScheduleBlocks(agentText, agentMsg.id);
        previousResponse = agentText;
        previousPersonaId = personaId;
      } catch { /* skip */ }
      setLoading(prev => { const n = { ...prev }; delete n[personaId]; return n; });
    }
  };

  // Insert @mention into input
  const insertMention = (id: string) => {
    setInput(prev => prev + `@${id} `);
    inputRef.current?.focus();
  };

  // Send message — supports both parallel (@a @b) and chain (@a → @b) syntax
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || Object.keys(loading).length > 0) return;
    setInput("");
    setRateLimitError(null);

    // Save user message
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: room.id, content: text }),
    });
    const saved = await res.json();
    if (saved.id) seenIds.current.add(saved.id);
    const userMsg: Message = { ...saved, role: "user", user_name: currentUser.name, user_avatar: currentUser.image };
    setMessages(prev => [...prev, userMsg]);
    setScreen("chat");

    const { mode, calls } = parseCallSyntax(text);
    const allMentions = calls.flat();
    if (!allMentions.length) return;

    // Directions context block
    const directionsBlock = directions.length > 0
      ? "PINNED DIRECTIONS:" + directions.map((d, i) => `${i + 1}. ${d}`).join("") : null;

    // Base history (full room log) — used for parallel, and as base for chain
    const baseHistory = [...messages, userMsg].map(m => ({
      role: m.role, persona: m.persona, content: m.content, user_name: m.user_name,
    }));
    if (directionsBlock) {
      baseHistory.unshift({ role: "system", persona: undefined, content: directionsBlock, user_name: undefined });
    }

    // Mark all mentioned agents as loading
    const newLoading: Record<string, boolean> = {};
    allMentions.forEach(id => { newLoading[id] = true; });
    setLoading(newLoading);

    // ── Helper: call one agent and append result ───────────────────────────
    const callAgent = async (
      personaId: AgentId,
      history: Array<{ role: string; persona?: string; content: string; user_name?: string }>,
      chainContext: string | null, // the previous agent's response in a chain
      previousPersonaId: AgentId | null,
    ): Promise<string | null> => {
      try {
        const agentRes: Response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personaId,
            userMessage: text,
            roomId: room.id,
            history,
            allMentions,
            chainContext,     // server uses this when present for the handoff prompt
            previousPersona: previousPersonaId,
            agentContext: buildAgentContext(personaId),
            lengthMultiplier: responseLength === "parsimonious" ? 0.4 : responseLength === "verbose" ? 1.8 : 1.0,
          }),
        });

        if (agentRes.status === 429) {
          const err = await agentRes.json();
          setRateLimitError(err.message ?? "Rate limit reached. Try again next hour.");
          setLoading({});
          return null;
        }

        const { text: agentText, id: agentId } = await agentRes.json();
        if (agentId) seenIds.current.add(agentId);

        const agentMsg: Message = {
          id: agentId ?? `${Date.now()}-${personaId}`,
          role: "agent",
          persona: personaId as PersonaId,
          content: agentText,
          created_at: now(),
        };
        setMessages(prev => [...prev, agentMsg]);
        if (personaId === "scheduler") parseScheduleBlocks(agentText, agentMsg.id);
        return agentText;
      } catch {
        return null;
      } finally {
        setLoading(prev => { const n = { ...prev }; delete n[personaId]; return n; });
      }
    };

    if (mode === "parallel") {
      // All agents get the same base history, fire sequentially
      const historySnapshot = [...baseHistory];
      for (const personaId of allMentions) {
        const result = await callAgent(personaId, historySnapshot, null, null);
        if (result === null && Object.keys(loading).length === 0) return;
        if (result) historySnapshot.push({ role: "agent", persona: personaId, content: result, user_name: undefined });
      }
    } else {
      // Chain: each agent gets original prompt + ONLY the previous agent's response
      let previousResponse: string | null = null;
      let previousPersonaId: AgentId | null = null;
      for (const personaId of allMentions) {
        // Chain history: base history + just the previous agent's response (Option B)
        const chainHistory = previousResponse && previousPersonaId
          ? [...baseHistory, { role: "agent" as const, persona: previousPersonaId, content: previousResponse, user_name: undefined }]
          : [...baseHistory];

        const result = await callAgent(personaId, chainHistory, previousResponse, previousPersonaId);
        if (result === null && Object.keys(loading).length === 0) return;
        previousResponse = result;
        previousPersonaId = personaId;
      }
    }
  }, [input, loading, messages, room.id, currentUser, agentCtx, directions, agentInspirations, agentVoices]);

  // Delete a message from local state
  const deleteMsg = (id: string) => setMessages(prev => prev.filter(m => m.id !== id));

  // Parse ```schedule JSON blocks from scheduler agent responses
  const parseScheduleBlocks = (text: string, msgId: string) => {
    const match = text.match(/```schedule\n([\s\S]*?)```/);
    if (!match) return;
    try {
      const events = JSON.parse(match[1]);
      if (!Array.isArray(events) || events.length === 0) return;
      setPendingCalendarEvents(prev => [
        ...prev.filter(e => e.msgId !== msgId), // deduplicate by message
        ...events.map((e: any) => ({ ...e, msgId })),
      ]);
    } catch { /* malformed JSON — ignore */ }
  };

  // Create a single calendar event after user confirms
  const createCalendarEvent = async (idx: number) => {
    const event = pendingCalendarEvents[idx];
    if (!event) return;
    setCreatingEvents(prev => new Set(prev).add(idx));
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "no_calendar_access" || data.error === "token_expired") {
          setRateLimitError(data.message);
        }
        return;
      }
      // Mark as created — show link
      setCreatedEvents(prev => new Set(prev).add(idx));
    } finally {
      setCreatingEvents(prev => { const n = new Set(prev); n.delete(idx); return n; });
    }
  };

  const dismissCalendarEvent = (idx: number) => {
    setPendingCalendarEvents(prev => prev.filter((_, i) => i !== idx));
    setCreatedEvents(prev => { const n = new Set(prev); n.delete(idx); return n; });
  };

  // Generate and download a .ics calendar file for a single event
  const downloadIcs = (ev: typeof pendingCalendarEvents[0]) => {
    const startDate = ev.date ? new Date(ev.date) : (() => {
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d;
    })();
    const durationMatch = (ev.duration ?? "1 hour").toLowerCase().match(/(\d+\.?\d*)\s*(h|m)/);
    const durationMins = durationMatch
      ? durationMatch[2] === "h" ? parseFloat(durationMatch[1]) * 60 : parseFloat(durationMatch[1])
      : 60;
    const endDate = new Date(startDate.getTime() + durationMins * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const uid = `${Date.now()}@writersroom`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Writers Room//EN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(startDate)}`,
      `DTEND:${fmt(endDate)}`,
      `SUMMARY:${ev.title}`,
      ev.notes ? `DESCRIPTION:${ev.notes.replace(/\n/g, "\\n")}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ev.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Clear conversation
  const clearConversation = () => {
    setMessages([]);
    setDirections([]);
    try { localStorage.removeItem(`wr-directions-${room.id}`); } catch {}
    setScreen("empty");
  };

  // Load demo conversation
  const loadDemo = () => {
    const demos: Record<string, Message[]> = {
      writers: [
        { id:"d1", role:"user", content:"@researcher — what are the key tensions in the slow journalism movement?", created_at:now(), user_name:currentUser.name },
        { id:"d2", role:"agent", persona:"researcher", content:"Four tensions stand out:\n(1) Depth vs. timeliness — readers want breaking news but reward depth.\n(2) Reader patience vs. engagement metrics — long reads win awards but lose clicks.\n(3) Prestige vs. revenue — high cost, low frequency.\n(4) Platform vs. ownership — distributed via social, dependent on owned channels.", created_at:now() },
        { id:"d3", role:"user", content:"@critic — what worries you about this framing?", created_at:now(), user_name:currentUser.name },
        { id:"d4", role:"agent", persona:"critic", content:"Slow journalism is a luxury product. The model assumes readers will wait. They won't. You're designing for an audience that doesn't exist at scale. And the economics don't work unless you have significant subscriber lock-in from day one.", created_at:now() },
        { id:"d5", role:"user", content:"@writer — try an opening paragraph", created_at:now(), user_name:currentUser.name },
        { id:"d6", role:"agent", persona:"writer", content:"In an era when attention is the scarcest resource, slow journalism makes an audacious bet on the reader. It says: trust me, this is worth an hour of your life. Sometimes it's right. The question is whether \"sometimes\" is enough to build a business on.", created_at:now() },
        { id:"d7", role:"agent", persona:"director", content:"Taking @researcher's tensions and @critic's challenge: reframe around the business model, not the format. The interesting story is whether slow journalism can survive economically — not whether it's better. That's the real tension.\n\nNext move: @writer, try again with the business model as the hook.", created_at:now() },
      ],
      jobhunt: [
        { id:"d1", role:"user", content:"I have a final round interview at a Series B fintech startup for a Senior PM role. @researcher — what should I know about them?", created_at:now(), user_name:currentUser.name },
        { id:"d2", role:"agent", persona:"researcher", content:"CLAIM: Series B fintechs hiring senior PMs typically have 3 key pressure points.\nEVIDENCE: (1) They've validated product-market fit but struggle with scaling ops. (2) Investors expect a roadmap shift from growth to monetisation. (3) Hiring bar is high — they want someone who's seen this movie before.\nSOURCE QUALITY: High — consistent across Crunchbase, product hiring postmortems.", created_at:now() },
        { id:"d3", role:"user", content:"@strategist — how should I position my background?", created_at:now(), user_name:currentUser.name },
        { id:"d4", role:"agent", persona:"strategist", content:"Lead with scale, not features. They don't need someone who can write PRDs — they need someone who's operated at the inflection point you're describing. Frame your narrative as: 'I've taken a product from traction to the messy middle — here's what I learned.'\n\nAvoid: talking about products you launched. Talk about decisions you made under uncertainty.", created_at:now() },
        { id:"d5", role:"user", content:"@coach — what's the hardest question they'll ask?", created_at:now(), user_name:currentUser.name },
        { id:"d6", role:"agent", persona:"coach", content:"'Tell me about a time you had to kill a project you championed.' They want to know you can separate your ego from your judgment. Weak answer: you pivoted gracefully. Strong answer: you killed it before anyone told you to, explained the reasoning to stakeholders, and redirected the team. Rehearse this one until it sounds like a story, not a lesson.", created_at:now() },
        { id:"d7", role:"agent", persona:"director", content:"You have the research, the positioning, and the hardest question mapped. The gap is your opening — the first 90 seconds when they ask 'tell me about yourself'.\n\nNext move: @strategist, draft a 90-second opening that leads with the scale narrative.", created_at:now() },
      ],
      career: [
        { id:"d1", role:"user", content:"I've been in my role 18 months. My manager likes me but I'm being passed over for the projects that lead to promotion. @navigator — what's happening?", created_at:now(), user_name:currentUser.name },
        { id:"d2", role:"agent", persona:"navigator", content:"Classic visibility gap, not performance gap. You're doing the work but not the work that's visible to the people who matter. The projects that lead to promotion are almost always the ones with cross-functional stakeholders or exec exposure. Your manager likes you — that's necessary but not sufficient. Who else knows your name?", created_at:now() },
        { id:"d3", role:"user", content:"@advocate — what do I actually do about it?", created_at:now(), user_name:currentUser.name },
        { id:"d4", role:"agent", persona:"advocate", content:"Three moves: (1) Ask your manager directly which projects have exec visibility and volunteer specifically for those. (2) Send a short written update to your manager after every significant win — one paragraph, make it easy to forward. (3) Find one cross-functional project where you can own a deliverable. You want other teams to associate your name with execution, not just your own manager.", created_at:now() },
        { id:"d5", role:"user", content:"@planner — give me a 90-day plan", created_at:now(), user_name:currentUser.name },
        { id:"d6", role:"agent", persona:"planner", content:"Days 1-30: Audit visibility. List every person above your manager who knows your work. If it's fewer than three, that's your constraint.\nDays 30-60: Volunteer for one high-visibility project. Send your first written update within the first week.\nDays 60-90: Have the promotion conversation with your manager — not to ask for it, but to align on what 'ready' looks like. Make them say it out loud.", created_at:now() },
        { id:"d7", role:"agent", persona:"director", content:"The diagnosis is clear, the moves are concrete, the plan is sequenced. The risk is that you execute the plan but the goalposts move because you never got alignment on what promotion actually requires.\n\nNext move: @advocate, draft the exact question to ask your manager about promotion criteria.", created_at:now() },
      ],
      publishing: [
        { id:"d1", role:"user", content:"I've finished a narrative non-fiction book about a cold case. @scout — where does it fit in the market?", created_at:now(), user_name:currentUser.name },
        { id:"d2", role:"agent", persona:"scout", content:"CLAIM: Narrative true crime non-fiction is healthy but increasingly competitive.\nEVIDENCE: Strong comps (I'll Be Gone in the Dark, Say Nothing) still sell. The market has bifurcated — literary true crime with a strong authorial voice does well; procedural rehashes don't.\nSOURCE QUALITY: High. The agent submission data is consistent with BookScan trends. Your angle matters more than the crime itself.", created_at:now() },
        { id:"d3", role:"user", content:"@pitcher — what does my query letter need to say?", created_at:now(), user_name:currentUser.name },
        { id:"d4", role:"agent", persona:"pitcher", content:"Lead with the crime in one sentence, then immediately pivot to what makes YOUR version of this story different. Agents see 50 cold case queries a week. The hook is your authorial access or angle, not the case.\n\nStructure: hook (1 sentence) → your angle / what makes this book yours (2 sentences) → comp titles (2 books, 1 film/podcast) → word count + your platform if relevant → brief bio.", created_at:now() },
        { id:"d5", role:"user", content:"@marketer — what's my platform strategy before I have a deal?", created_at:now(), user_name:currentUser.name },
        { id:"d6", role:"agent", persona:"marketer", content:"True crime has one of the strongest platform-to-book pipelines of any genre. If you don't have a podcast or Substack yet, start one now — not to build an audience before querying, but to demonstrate you understand how to reach your reader. Agents selling narrative non-fiction increasingly want to see this. Even 500 subscribers signals something.", created_at:now() },
        { id:"d7", role:"agent", persona:"director", content:"Market fit is confirmed, pitch structure is clear, platform gap is identified. The query is the bottleneck.\n\nNext move: @pitcher, draft the full query letter using the structure above.", created_at:now() },
      ],
    };
    const demo = demos[roomType] ?? demos.writers;
    setMessages(demo);
    setScreen("chat");
  };

  // Artifacts
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingArtifact(true);

    // API expects multipart/form-data — don't set Content-Type, browser adds boundary
    const formData = new FormData();
    formData.append("roomId", room.id);
    formData.append("file", file);

    const res = await fetch("/api/artifacts", { method: "POST", body: formData });
    if (res.ok) {
      const { artifact } = await res.json();
      if (artifact) setArtifacts(prev => [artifact, ...prev]);
    }
    setUploadingArtifact(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const deleteArtifact = async (id: string) => {
    await fetch(`/api/artifacts/${id}`, { method: "DELETE" });
    setArtifacts(prev => prev.filter(a => a.id !== id));
  };

  // Tone
  const applyTone = async () => {
    if (!spotifyUrl.trim()) return;
    setLoadingTone(true); setToneError("");
    const res = await fetch("/api/spotify", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ spotifyUrl }) });
    const data = await res.json();
    if (!res.ok) { setToneError(data.error ?? "Failed"); setLoadingTone(false); return; }
    await fetch(`/api/rooms/${room.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ active_tone: data }) });
    setRoom(prev => ({ ...prev, active_tone: data }));
    setLoadingTone(false); setSpotifyUrl("");
  };

  const clearTone = async () => {
    await fetch(`/api/rooms/${room.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ active_tone: null }) });
    setRoom(prev => ({ ...prev, active_tone: null }));
  };

  // NotebookLM
  const saveNotebooklm = async () => {
    setSavingNotebooklm(true);
    await fetch(`/api/rooms/${room.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ notebooklm_url: notebooklmUrl || null }) });
    setRoom(prev => ({ ...prev, notebooklm_url: notebooklmUrl || null }));
    setSavingNotebooklm(false);
  };

  // Review link
  const generateReview = async () => {
    setGeneratingReview(true);
    const res = await fetch("/api/review", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ roomId:room.id, expiresInHours:72 }) });
    const data = await res.json();
    setReviewLink(data.url ?? "");
    setGeneratingReview(false);
  };

  const copyReview = () => {
    navigator.clipboard.writeText(reviewLink);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    width:"100%", padding:"8px 10px", borderRadius:6,
    background:T.bg, border:`1px solid ${T.bdr2}`,
    color:T.text, fontSize:13, outline:"none", fontFamily:T.sans,
  };

  const tone = room.active_tone as SpotifyTone | null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      height:"100vh", background:T.bg, color:T.text,
      fontFamily:T.sans, display:"flex", flexDirection:"column", overflow:"hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;1,400&family=DM+Serif+Display:ital@0;1&family=Source+Serif+Pro:ital,wght@0,400;0,600;1,400;1,600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: ${T.bdr2}; border-radius: 2px; }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .msg-in { animation: fadeIn 0.2s ease; }
        textarea { resize:none; } textarea:focus, input:focus { outline:none; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        height:48, display:"flex", alignItems:"center", padding:"0 20px", gap:10,
        background:T.surf, borderBottom:`1px solid ${T.bdr}`, flexShrink:0,
      }}>
        {screen === "roles" ? (
          <>
            <button onClick={() => setScreen(messages.length > 0 ? "chat" : "empty")} style={{
              background:"none", border:"none", cursor:"pointer",
              fontFamily:T.mono, fontSize:11, color:T.sub, display:"flex", alignItems:"center", gap:5,
            }}>← back</button>
            <span style={{ fontFamily:T.mono, fontSize:10, color:T.text, letterSpacing:"0.14em", flex:1 }}>CONFIGURE ROLES</span>
          </>
        ) : (
          <>
            <button onClick={() => router.push("/rooms")} style={{ background:"none", border:"none", color:T.sub, fontSize:18, cursor:"pointer" }}>←</button>
            <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
              <span style={{ fontFamily:T.sans, fontSize:13, fontWeight:500, color:T.text, letterSpacing:"0.01em" }}>
                {room.name}
              </span>
              <span style={{
                fontSize:8, color:roomConfig.color, fontFamily:T.mono,
                background:roomConfig.color+"12",
                border:`1px solid ${roomConfig.color}33`,
                padding:"2px 7px", borderRadius:10,
              }}>
                {roomConfig.icon} {roomConfig.label.toUpperCase()}
              </span>
              {room.is_private && (
                <span style={{ fontSize:8, color:T.meta, fontFamily:T.mono, border:`1px solid ${T.bdr2}`, padding:"2px 6px", borderRadius:10 }}>
                  PRIVATE
                </span>
              )}
            </div>
            {tone && (
              <div style={{ display:"flex", alignItems:"center", gap:5, padding:"2px 8px", background:"#1e1030", border:"1px solid #c89cff30", borderRadius:12 }}>
                <span style={{ fontSize:10 }}>🎵</span>
                <span style={{ fontSize:9, color:"#c89cff", fontFamily:T.mono }}>{tone.trackName}</span>
              </div>
            )}
            {[
              { lbl:"⌘K", title:"Command palette (⌘K)", fn:() => setModal("command") },
              { lbl:"⚙",  title:"Configure roles",      fn:() => setScreen("roles")  },
              { lbl:"📝", title:"Room notes",            fn:() => setNotesOpen(o => !o) },
              { lbl:"⤴",  title:"Export session",        fn:handleExport },
              { lbl:"⌫",  title:"Clear conversation",   fn:() => setModal("clear")   },
            ].map(b => (
              <button key={b.lbl} onClick={b.fn} title={b.title} style={{
                background:"none", border:`1px solid ${T.bdr2}`, borderRadius:5,
                width:30, height:30, cursor:"pointer", color:T.sub,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:T.mono, fontSize:12,
              }}>{b.lbl}</button>
            ))}
          </>
        )}
      </div>

      {/* ── Screens ── */}
      {screen === "empty" && (
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          {/* Desktop cast list */}
          {!isMobile && (
            <div style={{ width:264, background:T.surf, borderRight:`1px solid ${T.bdr}`, display:"flex", flexDirection:"column", flexShrink:0 }}>
              <div style={{ padding:"18px 20px 14px", borderBottom:`1px solid ${T.bdr}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <span style={{ color:roomConfig.color, fontSize:14 }}>{roomConfig.icon}</span>
                  <span style={{ fontFamily:T.mono, fontSize:8.5, color:roomConfig.color, letterSpacing:"0.12em" }}>{roomConfig.label.toUpperCase()}</span>
                </div>
                <div style={{ fontFamily:T.mono, fontSize:8, color:T.meta, marginTop:4 }}>{roomConfig.description}</div>
              </div>
              <div style={{ flex:1, overflowY:"auto", padding:"10px 12px" }}>
                {AGENTS.map(a => (
                  <button key={a.id} onClick={() => insertMention(a.id)} style={{
                    width:"100%", background:"none",
                    border:`1px solid ${a.color}1e`, borderLeft:`3px solid ${a.color}`,
                    borderRadius:"0 6px 6px 0", padding:"13px 14px",
                    cursor:"pointer", textAlign:"left", marginBottom:7, display:"block",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:5 }}>
                      <span style={{ fontSize:18, color:a.color }}>{a.icon}</span>
                      <span style={{ fontFamily:T.mono, fontSize:11, color:a.color }}>@{a.id}</span>
                    </div>
                    <div style={{ fontFamily:T.mono, fontSize:8, color:T.meta, lineHeight:1.55, marginBottom:6 }}>{a.role}</div>
                    <div style={{ fontFamily:T.sans, fontSize:11.5, color:a.color+"77", fontStyle:"italic" }}>{a.tagline}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stage */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 24px", position:"relative" }}>
            <div style={{ textAlign:"center", marginBottom:36 }}>
              {/* Room type badge */}
              <div style={{
                display:"inline-flex", alignItems:"center", gap:6,
                padding:"4px 12px", borderRadius:20,
                background:roomConfig.color+"12", border:`1px solid ${roomConfig.color}30`,
                marginBottom:20,
              }}>
                <span style={{ color:roomConfig.color, fontSize:13 }}>{roomConfig.icon}</span>
                <span style={{ fontFamily:T.mono, fontSize:8.5, color:roomConfig.color, letterSpacing:"0.12em" }}>
                  {roomConfig.label.toUpperCase()}
                </span>
              </div>
              <div style={{ fontFamily:T.sans, fontSize:isMobile?16:19, color:"#555", lineHeight:1.5, maxWidth:360 }}>
                {{
                  writers:    "Drop in an idea. Call an agent.",
                  jobhunt:    "Describe the role or company you're working on.",
                  career:     "Describe the situation you want to think through.",
                  publishing: "Tell me about your work and where you are in the process.",
                }[roomType] ?? "Drop in an idea. Call an agent."}
              </div>
              <div style={{ marginTop:10, fontFamily:T.mono, fontSize:9, color:"#333" }}>
                type @ to call an agent · ⌘K for commands
              </div>
            </div>
            <div style={{ width:"100%", maxWidth:520 }}>
              <div style={{ background:T.surf, border:`1px solid ${T.bdr2}`, borderRadius:10, display:"flex", alignItems:"flex-end", padding:"12px 14px", gap:8 }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={isMobile
                    ? {
                        writers: "What are you working on?",
                        jobhunt: "Describe the role or company…",
                        career:  "What's the situation?",
                        publishing: "Tell me about your work…",
                      }[roomType] ?? "What are you working on?"
                    : `${roomConfig.description} — @ to call an agent`}
                  rows={2}
                  style={{ flex:1, background:"none", border:"none", outline:"none", resize:"none", fontFamily:T.sans, fontSize:14, color:T.text, lineHeight:1.55 }}
                />
                <button onClick={send} style={{ background:T.bdr2, border:"none", borderRadius:6, width:30, height:30, cursor:"pointer", color:T.sub, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:T.mono, fontSize:14, flexShrink:0 }}>↑</button>
              </div>
            </div>
            {isMobile && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:22, justifyContent:"center", padding:"0 8px" }}>
                {AGENTS.map(a => (
                  <button key={a.id} onClick={() => insertMention(a.id)} style={{
                    background:a.color+"16", border:`1px solid ${a.color}44`, borderRadius:99,
                    padding:"5px 12px", fontFamily:T.mono, fontSize:10, color:a.color, cursor:"pointer",
                  }}>{a.icon} @{a.id}</button>
                ))}
              </div>
            )}
            <div style={{ position:"absolute", bottom:28, fontFamily:T.mono, fontSize:8.5, color:T.sub, letterSpacing:"0.1em" }}>
              {isMobile ? "RETURN TO SEND" : "ENTER TO SEND · SHIFT+ENTER FOR NEW LINE · ⌘K FOR COMMANDS"}
            </div>
          </div>
        </div>
      )}

      {screen === "chat" && (
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
          {/* Pinned directions */}
          <DirectionsPanel directions={directions} onRemove={removeDirection} />

          {/* Calendar event confirmation panel */}
          {pendingCalendarEvents.length > 0 && (
            <div style={{
              background:"#0d0d0d", borderBottom:"1px solid #1e1e1e",
              padding:"12px 24px", flexShrink:0,
            }}>
              <div style={{ maxWidth:720, margin:"0 auto" }}>
                <div style={{ fontFamily:T.mono, fontSize:8.5, color:"#a78bfa", letterSpacing:"0.16em", marginBottom:10 }}>
                  ◷ SCHEDULE SUGGESTED
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                  {pendingCalendarEvents.map((ev, idx) => {
                    const isCreating = creatingEvents.has(idx);
                    const isDone = createdEvents.has(idx);
                    return (
                      <div key={idx} style={{
                        display:"flex", alignItems:"flex-start", gap:12,
                        padding:"10px 14px",
                        background: isDone ? "#0fe89810" : "#a78bfa0a",
                        border:`1px solid ${isDone ? "#0fe89840" : "#a78bfa30"}`,
                        borderRadius:6,
                      }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:T.sans, fontSize:13, color:T.text, marginBottom:2 }}>{ev.title}</div>
                          <div style={{ fontFamily:T.mono, fontSize:9, color:T.meta }}>
                            {ev.date ? new Date(ev.date).toLocaleString([], { dateStyle:"medium", timeStyle:"short" }) : "date TBD"}
                            {" · "}{ev.duration}
                          </div>
                          {ev.notes && (
                            <div style={{ fontFamily:T.sans, fontSize:11, color:T.sub, marginTop:3 }}>{ev.notes}</div>
                          )}
                        </div>
                        <div style={{ display:"flex", gap:6, flexShrink:0, alignItems:"center" }}>
                          {isDone ? (
                            <span style={{ fontFamily:T.mono, fontSize:9, color:"#0fe898" }}>✓ added to calendar</span>
                          ) : hasCalendarAccess ? (
                            <button
                              onClick={() => createCalendarEvent(idx)}
                              disabled={isCreating}
                              style={{
                                padding:"4px 12px", borderRadius:5,
                                background: isCreating ? "#1e1040" : "#2d1a5e",
                                border:"1px solid #a78bfa55",
                                color:"#a78bfa", fontFamily:T.mono, fontSize:9,
                                cursor: isCreating ? "wait" : "pointer",
                              }}
                            >
                              {isCreating ? "adding…" : "+ add to calendar"}
                            </button>
                          ) : (
                            <button
                              onClick={() => downloadIcs(ev)}
                              title="Download as .ics — opens in Google Calendar, Apple Calendar, Outlook"
                              style={{
                                padding:"4px 12px", borderRadius:5,
                                background:"#1a1a1a", border:`1px solid ${T.bdr2}`,
                                color:T.sub, fontFamily:T.mono, fontSize:9, cursor:"pointer",
                              }}
                            >
                              ⤵ download .ics
                            </button>
                          )}
                          <button
                            onClick={() => dismissCalendarEvent(idx)}
                            style={{ background:"none", border:"none", color:T.meta, cursor:"pointer", fontSize:14, lineHeight:1 }}
                          >×</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div
            ref={scrollRef}
            onScroll={() => {
              const el = scrollRef.current;
              if (!el) return;
              const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              setIsAtBottom(nearBottom);
              if (nearBottom) setUnreadCount(0);
            }}
            style={{ flex:1, overflowY:"auto", padding:"24px 24px 120px" }}>
            <div style={{ maxWidth:720, margin:"0 auto" }}>
              {messages.length === 0 && (
                <div style={{ textAlign:"center", marginTop:80, fontFamily:T.mono, fontSize:11, color:T.meta, letterSpacing:"0.12em" }}>
                  CONVERSATION CLEARED — START AGAIN BELOW
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className="msg-in">
                  <MsgComponent msg={msg} onDelete={deleteMsg} onSave={saveDirection} onContinue={continueFromDirector} canSave={directions.length < 5} reactions={messageReactions[msg.id] ?? []} onReact={toggleReaction} onCallChain={callDirectorChain} agents={AGENTS} collapsed={collapsedMsgs.has(msg.id)} onToggleCollapse={toggleCollapse} />
                </div>
              ))}

              {/* Typing indicators */}
              {Object.keys(loading).map(pId => {
                const a = getAgent(pId, AGENTS);
                return (
                  <div key={`typing-${pId}`} className="msg-in" style={{ marginBottom:28, display:"flex", gap:8, alignItems:"flex-start" }}>
                    <div style={{ fontSize:15, color:a.color }}>{a.icon}</div>
                    <div>
                      <div style={{ fontFamily:T.mono, fontSize:9.5, color:a.color, marginBottom:8 }}>@{a.id}</div>
                      <div style={{ background:a.color+"0a", border:`1px solid ${a.color}30`, borderLeft:`3px solid ${a.color}`, padding:"10px 14px", display:"inline-flex", gap:5 }}>
                        {[0,1,2].map(i => <div key={i} style={{ width:5, height:5, borderRadius:"50%", background:a.color, animation:"bounce 1.2s ease-in-out infinite", animationDelay:`${i*0.2}s`, opacity:0.7 }} />)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* New messages pill — shown when scrolled up */}
          {!isAtBottom && unreadCount > 0 && (
            <div
              onClick={() => {
                bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                setIsAtBottom(true);
                setUnreadCount(0);
              }}
              style={{
                position:"absolute", bottom:100, left:"50%",
                transform:"translateX(-50%)",
                background:"#1d3461", border:"1px solid #4da8ff55",
                borderRadius:20, padding:"6px 16px",
                display:"flex", alignItems:"center", gap:6,
                cursor:"pointer", zIndex:60,
                boxShadow:"0 4px 20px rgba(0,0,0,0.6)",
                animation:"fadeIn 0.2s ease",
              }}
            >
              <span style={{ fontSize:11, color:"#4da8ff", fontFamily:T.mono }}>
                ↓ {unreadCount} new {unreadCount === 1 ? "message" : "messages"}
              </span>
            </div>
          )}

          {/* Floating dock */}
          {!isMobile && <FloatingDock onMention={insertMention} onChain={insertChain} agentCtx={agentCtx} agents={AGENTS} />}

          {/* Input bar */}
          <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:50, background:`linear-gradient(transparent, ${T.bg} 36%)`, padding:"28px 24px 20px" }}>
            <div style={{ maxWidth:720, margin:"0 auto" }}>
          {rateLimitError && (
            <div style={{ marginBottom:10, padding:"8px 12px", background:"#ff5a5a18", border:"1px solid #ff5a5a44", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontFamily:T.mono, fontSize:10, color:"#ff5a5a" }}>⚡ {rateLimitError}</span>
              <button onClick={() => setRateLimitError(null)} style={{ background:"none", border:"none", color:"#ff5a5a", cursor:"pointer", fontSize:14 }}>×</button>
            </div>
          )}
          {/* Token counter + length toggle */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            {/* Estimated token count */}
            {input.length > 0 && (() => {
              const est = Math.ceil(input.length / 4);
              const warn = est > 600;
              return (
                <span style={{ fontFamily:T.mono, fontSize:9, color: warn ? "#f97316" : "#333", letterSpacing:"0.06em" }}>
                  ~{est} tokens
                </span>
              );
            })()}
            <div style={{ flex:1 }} />
            {/* Response length toggle */}
            {(["parsimonious", "normal", "verbose"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setResponseLength(mode)}
                title={{
                  parsimonious: "Parsimonious — short, focused responses",
                  normal:       "Normal — default response length",
                  verbose:      "Verbose — longer, more thorough responses",
                }[mode]}
                style={{
                  padding:"2px 8px", borderRadius:4,
                  background: responseLength === mode ? T.surf2 : "none",
                  border: `1px solid ${responseLength === mode ? T.bdr2 : "transparent"}`,
                  color: responseLength === mode ? T.text : "#333",
                  fontFamily:T.mono, fontSize:8.5, cursor:"pointer",
                  letterSpacing:"0.04em", transition:"all 0.15s",
                }}
              >
                {mode === "parsimonious" ? "⊟ terse" : mode === "normal" ? "⊡ normal" : "⊞ verbose"}
              </button>
            ))}
          </div>

          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
              <div style={{ flex:1, background:T.surf, border:`1px solid ${T.bdr2}`, borderRadius:10, display:"flex", alignItems:"flex-end", padding:"10px 14px", gap:8 }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={isReadOnly ? "Read-only review mode — sign in to chat" : "Type… @agent parallel · @a → @b chain · TAB to cycle"}
                  disabled={isReadOnly}
                  rows={1}
                  style={{ flex:1, background:"none", border:"none", outline:"none", resize:"none", fontFamily:T.sans, fontSize:14, color:T.text, lineHeight:1.55, maxHeight:120, overflowY:"auto" }}
                  onInput={(e:any) => { e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; }}
                />
                <button onClick={send} disabled={!input.trim() || Object.keys(loading).length > 0 || isReadOnly} style={{
                  background: Object.keys(loading).length > 0 ? T.bdr : T.bdr2,
                  border:"none", borderRadius:6, width:30, height:30, cursor:"pointer",
                  color:T.sub, display:"flex", alignItems:"center", justifyContent:"center",
                  fontFamily:T.mono, fontSize:14, flexShrink:0,
                }}>↑</button>
              </div>
              {isMobile && (
                <button onClick={() => setShowSheet(true)} style={{
                  width:46, height:46, background:T.surf, border:`1px solid ${T.bdr2}`,
                  borderRadius:10, fontFamily:T.mono, fontSize:18, color:T.sub,
                  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                }}>@</button>
              )}
            </div>
            {/* Reactions key — visible but unobtrusive below input */}
            {!isMobile && (
              <div style={{
                maxWidth:720, margin:"6px auto 0",
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"0 2px",
              }}>
                <span style={{ fontFamily:T.mono, fontSize:8.5, color:"#2e2e2e", letterSpacing:"0.08em" }}>
                  ENTER SEND · TAB CYCLE · ⌘1–5 AGENT · @a @b PARALLEL · @a → @b CHAIN · ⌘K
                </span>
                <span style={{ fontFamily:T.mono, fontSize:8.5, color:"#2e2e2e", letterSpacing:"0.06em", display:"flex", alignItems:"center", gap:8 }}>
                  hover to react:
                  <span title="Mark as useful">👍 useful</span>
                  <span title="Key insight">💡 insight</span>
                  <span title="Save to directions">⭐ direction</span>
                </span>
              </div>
            )}
            </div>
          </div>
        </div>
        {notesOpen && (
          <NotesPanel
            notes={notes}
            onChange={handleNotesChange}
            saving={notesSaving}
            onClose={() => setNotesOpen(false)}
          />
        )}
        </div>
      )}

      {screen === "roles" && (
        <div style={{ flex:1, overflowY:"auto", padding:"36px 24px 60px" }}>
          <div style={{ maxWidth:680, margin:"0 auto" }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:32, gap:16 }}>
              <p style={{ fontFamily:T.sans, fontSize:13, color:T.sub, lineHeight:1.7, maxWidth:480 }}>
                Add notes and voice settings for each agent. Changes are reflected live in the composed prompt.
              </p>
              <button
                onClick={exportAllPrompts}
                title="Download all five composed prompts as .md"
                style={{ flexShrink:0, padding:"7px 14px", borderRadius:6, background:"#062b1e", border:"1px solid #0fe89830", color:"#0fe898", fontSize:11, cursor:"pointer", fontFamily:T.mono, letterSpacing:"0.06em", whiteSpace:"nowrap" }}
              >
                ⤴ Export all prompts
              </button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {AGENTS.map(a => (
                <div key={a.id} style={{ background:T.surf, border:`1px solid ${T.bdr}`, borderLeft:`3px solid ${a.color}`, borderRadius:"0 8px 8px 0", padding:"18px 20px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                    <span style={{ fontSize:20, color:a.color }}>{a.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:T.mono, fontSize:11, color:a.color, marginBottom:3 }}>@{a.id}</div>
                      <div style={{ fontFamily:T.mono, fontSize:8, color:T.meta }}>{a.role}</div>
                    </div>
                    <div style={{ fontFamily:T.sans, fontSize:11.5, color:a.color+"66", fontStyle:"italic" }}>{a.tagline}</div>
                  </div>
                  <textarea
                    value={agentCtx[a.id] || ""}
                    onChange={e => updateAgentCtx(a.id, e.target.value)}
                    placeholder={
                      a.id==="researcher" ? `e.g. "Focus on peer-reviewed sources. The project is about climate adaptation in coastal cities."` :
                      a.id==="writer"     ? `e.g. "My writing voice is essayistic and first-person. Target reader is a policy professional."` :
                      a.id==="editor"     ? `e.g. "House style: short paragraphs, no jargon, active voice. Under 800 words for drafts."` :
                      a.id==="critic"     ? `e.g. "Be direct. Don't soften critique. I care most about logical consistency and evidence."` :
                                            `e.g. "Final output is a 3,000 word feature pitch to editors at a major newspaper."`
                    }
                    rows={3}
                    style={{ width:"100%", background:T.bg, border:`1px solid ${T.bdr2}`, borderRadius:6, padding:"10px 12px", resize:"vertical", fontFamily:T.sans, fontSize:13, color:T.text, lineHeight:1.6, outline:"none" }}
                  />
                  {/* Voice picker — dropdowns with custom write-in */}
                  <div style={{ borderTop:`1px solid ${T.bdr}`, paddingTop:14, marginTop:4 }}>
                    {(["persona","genre","career"] as const).map(cat => {
                      const OPTS: Record<string, string[]> = {
                        persona: ["Christopher Hitchens","Joan Didion","David Foster Wallace","Zadie Smith","Malcolm Gladwell","Ta-Nehisi Coates","Hunter S. Thompson","Susan Sontag","George Orwell","Toni Morrison"],
                        genre:   ["Literary Journalism","Academic","Investigative","Gonzo","Business","Technical","Op-Ed","Lyric Essay","Narrative Non-fiction","Satire"],
                        career:  ["Investigative Reporter","Brand Strategist","Senior Editor","Academic Researcher","Ghostwriter","Film Critic","Science Journalist","Cultural Critic","Political Analyst","Copywriter"],
                      };
                      const LABELS: Record<string, string> = {
                        persona: "PERSONA — write like",
                        genre:   "GENRE — style",
                        career:  "CAREER — perspective",
                      };
                      const stored = agentVoices[a.id]?.[cat] ?? null;
                      const isPredefined = stored !== null && OPTS[cat].includes(stored);
                      const isCustom = stored !== null && !isPredefined;
                      // dropdown value: predefined option, "__custom__" if custom, or "" for none
                      const dropdownValue = isPredefined ? stored : isCustom ? "__custom__" : "";

                      const selectStyle: React.CSSProperties = {
                        width:"100%", padding:"7px 10px", borderRadius:5,
                        background:T.bg, border:`1px solid ${stored ? a.color+"55" : T.bdr2}`,
                        color: stored ? a.color : T.sub,
                        fontFamily:T.sans, fontSize:12, outline:"none",
                        cursor:"pointer", appearance:"none" as any,
                        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23555' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                        backgroundRepeat:"no-repeat",
                        backgroundPosition:"right 10px center",
                        paddingRight:28,
                      };

                      return (
                        <div key={cat} style={{ marginBottom:12 }}>
                          <div style={{ fontFamily:T.mono, fontSize:8, color:T.meta, letterSpacing:"0.12em", marginBottom:5 }}>
                            {LABELS[cat]}
                          </div>

                          {/* Dropdown */}
                          <select
                            value={dropdownValue}
                            onChange={e => {
                              const v = e.target.value;
                              if (v === "") updateAgentVoice(a.id, cat, null);
                              else if (v === "__custom__") updateAgentVoice(a.id, cat, "");
                              else updateAgentVoice(a.id, cat, v);
                            }}
                            style={selectStyle}
                          >
                            <option value="">— none —</option>
                            {OPTS[cat].map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                            <option value="__custom__">Custom…</option>
                          </select>

                          {/* Custom write-in — shown when Custom… is selected */}
                          {(dropdownValue === "__custom__" || isCustom) && (
                            <input
                              type="text"
                              value={stored ?? ""}
                              onChange={e => updateAgentVoice(a.id, cat, e.target.value || null)}
                              placeholder={
                                cat === "persona" ? "e.g. Ernest Hemingway" :
                                cat === "genre"   ? "e.g. Travel writing" :
                                                    "e.g. Food writer"
                              }
                              autoFocus
                              style={{
                                marginTop:6, width:"100%", padding:"7px 10px",
                                borderRadius:5, background:T.bg,
                                border:`1px solid ${a.color+"55"}`,
                                color:a.color, fontFamily:T.sans, fontSize:12,
                                outline:"none",
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Inspirations */}
                  <div style={{ borderTop:`1px solid ${T.bdr}`, marginTop:14, paddingTop:14 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                      <span style={{ fontFamily:T.mono, fontSize:8, color:T.meta, letterSpacing:"0.12em" }}>
                        INSPIRATIONS
                      </span>
                      <span style={{ fontFamily:T.mono, fontSize:8, color: (agentInspirations[a.id]?.length ?? 0) >= 13 ? "#ff5a5a" : "#333" }}>
                        {agentInspirations[a.id]?.length ?? 0}/13
                      </span>
                    </div>

                    {/* Existing tags */}
                    {(agentInspirations[a.id]?.length ?? 0) > 0 && (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
                        {(agentInspirations[a.id] ?? []).map((item, idx) => (
                          <div key={idx} style={{
                            display:"flex", alignItems:"center", gap:4,
                            padding:"3px 8px 3px 10px",
                            background:a.color+"18", border:`1px solid ${a.color}44`,
                            borderRadius:99, fontSize:11,
                          }}>
                            <span style={{ color:a.color+"cc", fontFamily:T.sans }}>{item}</span>
                            <button
                              onClick={() => removeInspiration(a.id, idx)}
                              style={{ background:"none", border:"none", cursor:"pointer", color:a.color+"88", fontSize:12, lineHeight:1, padding:"0 2px" }}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add input */}
                    {(agentInspirations[a.id]?.length ?? 0) < 13 && (
                      <div style={{ display:"flex", gap:6 }}>
                        <input
                          value={inspirationInputs[a.id] ?? ""}
                          onChange={e => setInspirationInputs(prev => ({ ...prev, [a.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addInspiration(a.id, inspirationInputs[a.id] ?? ""); } }}
                          placeholder={
                            a.id === "researcher" ? "e.g. The Lancet, Wikipedia style, Feynman Technique" :
                            a.id === "writer"     ? "e.g. The Great Gatsby, Joan Didion's essays" :
                            a.id === "editor"     ? "e.g. The Elements of Style, On Writing Well" :
                            a.id === "critic"     ? "e.g. Christopher Hitchens debates, NY Review of Books" :
                                                    "e.g. This American Life, The New Yorker longform"
                          }
                          style={{
                            flex:1, padding:"7px 10px", borderRadius:5,
                            background:T.bg, border:`1px solid ${T.bdr2}`,
                            color:T.text, fontFamily:T.sans, fontSize:12, outline:"none",
                          }}
                        />
                        <button
                          onClick={() => addInspiration(a.id, inspirationInputs[a.id] ?? "")}
                          disabled={!(inspirationInputs[a.id]?.trim())}
                          style={{
                            padding:"7px 12px", borderRadius:5,
                            background: inspirationInputs[a.id]?.trim() ? a.color+"22" : "none",
                            border:`1px solid ${inspirationInputs[a.id]?.trim() ? a.color+"55" : T.bdr2}`,
                            color: inspirationInputs[a.id]?.trim() ? a.color : T.meta,
                            fontSize:11, cursor:"pointer", fontFamily:T.mono,
                            transition:"all 0.15s",
                          }}
                        >+ add</button>
                      </div>
                    )}
                    {(agentInspirations[a.id]?.length ?? 0) >= 13 && (
                      <p style={{ fontFamily:T.mono, fontSize:9, color:"#ff3d3d88" }}>
                        13 inspirations saved — remove one to add more.
                      </p>
                    )}
                  </div>

                  {/* Composed prompt preview + per-agent export */}
                  <div style={{ borderTop:`1px solid ${T.bdr}`, marginTop:14, paddingTop:12 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: expandedPrompt === a.id ? 10 : 0 }}>
                      <button
                        onClick={() => setExpandedPrompt(expandedPrompt === a.id ? null : a.id)}
                        style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:6, padding:0 }}
                      >
                        <span style={{ fontFamily:T.mono, fontSize:8, color:T.meta, letterSpacing:"0.12em" }}>
                          COMPOSED PROMPT
                        </span>
                        <span style={{ fontSize:9, color:T.meta }}>
                          {expandedPrompt === a.id ? "▲" : "▼"}
                        </span>
                      </button>
                      <div style={{ display:"flex", gap:6 }}>
                        {/* Copy this agent's prompt */}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(buildComposedPrompt(a.id));
                          }}
                          title="Copy composed prompt"
                          style={{ padding:"3px 10px", borderRadius:4, background:"none", border:`1px solid ${T.bdr2}`, color:T.sub, fontSize:10, cursor:"pointer", fontFamily:T.mono }}
                        >
                          ⎘ copy
                        </button>
                        {/* Export this agent's prompt as .txt */}
                        <button
                          onClick={() => {
                            const text = buildComposedPrompt(a.id);
                            const blob = new Blob([text], { type:"text/plain" });
                            const url = URL.createObjectURL(blob);
                            const el = document.createElement("a");
                            el.href = url; el.download = `${a.id}-prompt.txt`; el.click();
                            URL.revokeObjectURL(url);
                          }}
                          title="Download as .txt"
                          style={{ padding:"3px 10px", borderRadius:4, background:"none", border:`1px solid ${T.bdr2}`, color:T.sub, fontSize:10, cursor:"pointer", fontFamily:T.mono }}
                        >
                          ⤴ .txt
                        </button>
                      </div>
                    </div>
                    {expandedPrompt === a.id && (
                      <pre style={{
                        margin:0, padding:"12px 14px",
                        background:T.bg, border:`1px solid ${T.bdr2}`,
                        borderLeft:`3px solid ${a.color}50`,
                        borderRadius:"0 6px 6px 0",
                        fontFamily:T.mono, fontSize:11, color:"#aaa",
                        lineHeight:1.65, whiteSpace:"pre-wrap",
                        wordBreak:"break-word", maxHeight:280, overflowY:"auto",
                      }}>
                        {buildComposedPrompt(a.id)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily:T.mono, fontSize:9, color:T.meta, marginTop:24, letterSpacing:"0.1em" }}>
              CHANGES SAVE AUTOMATICALLY
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {modal === "command" && (
        <CommandPalette
          onClose={() => setModal(null)}
          onScreen={(s) => setScreen(s)}
          onClear={() => setModal("clear")}
          onDemo={() => { loadDemo(); setModal(null); }}
          onModal={setModal}
          onExport={handleExport}
        />
      )}

      {modal === "clear" && (
        <ClearConfirm onConfirm={() => { clearConversation(); setModal(null); }} onCancel={() => setModal(null)} />
      )}

      {modal === "artifacts" && (
        <FeatureModal title="ARTIFACTS — REFERENCE MATERIAL" onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <p style={{ fontFamily:T.mono, fontSize:10, color:T.meta }}>Uploaded files are injected into every agent's context. Supported: .txt, .md, .json, .csv</p>
            <input ref={fileRef} type="file" accept=".txt,.md,.json,.csv" onChange={handleFileUpload} style={{ display:"none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploadingArtifact} style={{ alignSelf:"flex-start", padding:"7px 14px", borderRadius:6, background:"#0d2240", border:"1px solid #4da8ff44", color:"#4da8ff", fontSize:12, cursor:"pointer", fontFamily:T.mono }}>
              {uploadingArtifact ? "Uploading…" : "+ Upload file"}
            </button>
            {artifacts.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {artifacts.map(a => (
                  <div key={a.id} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", background:T.surf, border:`1px solid ${T.bdr2}`, borderRadius:6, fontSize:12 }}>
                    <span style={{ color:T.meta, fontFamily:T.mono }}>{a.mime_type ?? a.kind}</span>
                    <span style={{ color:T.text }}>{a.name}</span>
                    <button onClick={() => deleteArtifact(a.id)} style={{ background:"none", border:"none", color:T.meta, cursor:"pointer", fontSize:14 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            {artifacts.length === 0 && <p style={{ fontFamily:T.mono, fontSize:11, color:T.bdr2 }}>No artifacts yet.</p>}
          </div>
        </FeatureModal>
      )}

      {modal === "tone" && (
        <FeatureModal title="SECTION TONE — SPOTIFY" onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {tone && (
              <div style={{ padding:"10px 14px", background:"#1e1030", border:"1px solid #c89cff30", borderRadius:8 }}>
                <div style={{ fontSize:13, color:"#c89cff", marginBottom:4 }}>🎵 {tone.trackName} — {tone.artistName}</div>
                <div style={{ fontSize:11, color:T.meta, marginBottom:8 }}>{tone.descriptor}</div>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {tone.moodTags.map((t: string) => <span key={t} style={{ fontSize:9, color:"#c89cff80", border:"1px solid #c89cff30", padding:"1px 6px", borderRadius:10, fontFamily:T.mono }}>{t}</span>)}
                </div>
                <button onClick={clearTone} style={{ marginTop:10, background:"none", border:"1px solid #2a0808", color:"#ff5a5a", padding:"4px 10px", borderRadius:5, fontSize:11, cursor:"pointer", fontFamily:T.mono }}>Clear tone</button>
              </div>
            )}
            <input value={spotifyUrl} onChange={e => { setSpotifyUrl(e.target.value); setToneError(""); }} placeholder="https://open.spotify.com/track/…" style={inputStyle} />
            {toneError && <p style={{ fontSize:11, color:"#ff5a5a" }}>{toneError}</p>}
            <button onClick={applyTone} disabled={loadingTone || !spotifyUrl.trim()} style={{ alignSelf:"flex-start", padding:"7px 14px", borderRadius:6, background:"#0d2240", border:"1px solid #4da8ff44", color:"#4da8ff", fontSize:12, cursor:"pointer", fontFamily:T.mono }}>
              {loadingTone ? "Analysing…" : "Set tone"}
            </button>
            <p style={{ fontFamily:T.mono, fontSize:10, color:T.meta }}>Requires SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET in environment variables.</p>
          </div>
        </FeatureModal>
      )}

      {modal === "notebooklm" && (
        <FeatureModal title="NOTEBOOKLM BRIDGE" onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <p style={{ fontFamily:T.mono, fontSize:10, color:T.meta }}>Link your NotebookLM notebook. Export session as Lore Pack to import as a source.</p>
            <input value={notebooklmUrl} onChange={e => setNotebooklmUrl(e.target.value)} placeholder="https://notebooklm.google.com/notebook/…" style={inputStyle} />
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={saveNotebooklm} disabled={savingNotebooklm} style={{ padding:"7px 14px", borderRadius:6, background:"#0d2240", border:"1px solid #4da8ff44", color:"#4da8ff", fontSize:12, cursor:"pointer", fontFamily:T.mono }}>
                {savingNotebooklm ? "Saving…" : "Save URL"}
              </button>
              {room.notebooklm_url && <a href={room.notebooklm_url} target="_blank" rel="noopener noreferrer" style={{ padding:"7px 14px", borderRadius:6, background:"none", border:`1px solid ${T.bdr2}`, color:T.sub, fontSize:12, textDecoration:"none", display:"flex", alignItems:"center" }}>Open →</a>}
            </div>
            <button onClick={() => window.open(`/api/rooms/${room.id}/export`, "_blank")} style={{ alignSelf:"flex-start", padding:"7px 16px", borderRadius:6, background:"#062b1e", border:"1px solid #0fe89830", color:"#0fe898", fontSize:12, cursor:"pointer", fontFamily:T.mono }}>
              ↓ Export Lore Pack (.md)
            </button>
          </div>
        </FeatureModal>
      )}

      {modal === "review" && (
        <FeatureModal title="SHARE REVIEW LINK" onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <p style={{ fontFamily:T.mono, fontSize:10, color:T.meta }}>Generates a read-only link to this session. No login required. Expires in 72 hours.</p>
            {reviewLink ? (
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1, padding:"8px 10px", background:T.bg, border:`1px solid ${T.bdr2}`, borderRadius:6, fontFamily:T.mono, fontSize:11, color:T.sub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {reviewLink}
                </div>
                <button onClick={copyReview} style={{ padding:"7px 14px", borderRadius:6, background: copied?"#062b1e":"none", border:`1px solid ${copied?"#0fe898":"#2a2a2a"}`, color: copied?"#0fe898":T.sub, fontSize:12, cursor:"pointer", fontFamily:T.mono }}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            ) : (
              <button onClick={generateReview} disabled={generatingReview} style={{ alignSelf:"flex-start", padding:"7px 14px", borderRadius:6, background:"#0d2240", border:"1px solid #4da8ff44", color:"#4da8ff", fontSize:12, cursor:"pointer", fontFamily:T.mono }}>
                {generatingReview ? "Generating…" : "Generate review link"}
              </button>
            )}
            <div style={{ borderTop:`1px solid ${T.bdr}`, paddingTop:12 }}>
              <p style={{ fontFamily:T.mono, fontSize:10, color:T.meta, marginBottom:6 }}>ROOM INVITE CODE — for collaborators who can chat</p>
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1, padding:"8px 10px", background:T.bg, border:`1px solid ${T.bdr2}`, borderRadius:6, fontFamily:T.mono, fontSize:13, color:T.sub }}>{room.invite_code}</div>
                <button onClick={() => navigator.clipboard.writeText(room.invite_code ?? "")} style={{ padding:"7px 12px", borderRadius:6, background:"none", border:`1px solid ${T.bdr2}`, color:T.sub, fontSize:12, cursor:"pointer" }}>Copy</button>
              </div>
            </div>
          </div>
        </FeatureModal>
      )}

      {showSheet && <AgentBottomSheet onMention={insertMention} onClose={() => setShowSheet(false)} agents={AGENTS} />}
    </div>
  );
}
