"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

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

const NAV_SECTIONS = [
  "Profile",
  "Integrations",
  "Sharing & links",
  "Privacy & retention",
  "Keyboard shortcuts",
];

const INTEGRATIONS = [
  {
    name: "NotebookLM",
    sub: "Export room Lore Packs · import audio overviews",
    connected: true,
    detail: "Set per room via ⌘K → NotebookLM bridge",
    icon: "◎",
    color: "#c89cff",
  },
  {
    name: "Google Drive",
    sub: "Export sessions as Google Docs · import documents as artifacts",
    connected: true,
    detail: "Active when signed in with Google",
    icon: "↗",
    color: "#4da8ff",
  },
  {
    name: "Google Calendar",
    sub: "@scheduler can propose and write events",
    connected: true,
    detail: "Active when signed in with Google",
    icon: "⌖",
    color: "#0fe898",
  },
  {
    name: "Spotify",
    sub: "Read 'now playing' as room mood · set section tone",
    connected: false,
    detail: null,
    icon: "♫",
    color: "#1db954",
  },
  {
    name: "Linear",
    sub: "Career room → ticket and project sync",
    connected: false,
    detail: null,
    icon: "◈",
    color: "#5e6ad2",
  },
  {
    name: "GitHub",
    sub: "Read repo files for code-adjacent rooms",
    connected: false,
    detail: null,
    icon: "◇",
    color: T.sub,
  },
  {
    name: "Gmail",
    sub: "Read selected threads (manual select only)",
    connected: false,
    detail: null,
    icon: "✉",
    color: "#ea4335",
  },
];

function IntegrationCard({ int }: { int: typeof INTEGRATIONS[0] }) {
  return (
    <div style={{
      padding: "12px 14px",
      background: T.surf,
      border: `1px solid ${T.bdr}`,
      borderLeft: `2px solid ${int.connected ? int.color : T.bdr2}`,
      borderRadius: "0 6px 6px 0",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: int.connected ? int.color : T.meta, fontSize: 14 }}>{int.icon}</span>
          <span style={{ fontFamily: T.sans, fontSize: 13.5, color: T.text, fontWeight: 500 }}>{int.name}</span>
        </div>
        <span style={{ fontFamily: T.mono, fontSize: 9, color: int.connected ? "#0fe898" : T.meta, letterSpacing: "0.1em" }}>
          {int.connected ? "● CONNECTED" : "AVAILABLE"}
        </span>
      </div>
      <div style={{ fontFamily: T.serif, fontSize: 12, color: T.body, lineHeight: 1.5, marginBottom: int.detail ? 8 : 0 }}>
        {int.sub}
      </div>
      {int.detail && (
        <div style={{ paddingTop: 7, borderTop: `1px dashed ${T.bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.meta, letterSpacing: "0.04em" }}>{int.detail}</span>
        </div>
      )}
      {!int.connected && (
        <div style={{ marginTop: 8 }}>
          <span style={{ display: "inline-block", padding: "3px 10px", background: "#c89cff18", border: "1px solid #c89cff55", borderRadius: 3, fontFamily: T.mono, fontSize: 9, color: "#c89cff", letterSpacing: "0.08em", cursor: "pointer" }}>
            + CONNECT
          </span>
        </div>
      )}
    </div>
  );
}

function ProfileSection({ session }: { session: any }) {
  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 0", borderBottom: `1px solid ${T.bdr}`, marginBottom: 24 }}>
        {session?.user?.image
          ? <img src={session.user.image} alt="" style={{ width: 56, height: 56, borderRadius: "50%", border: `2px solid ${T.bdr2}` }} />
          : <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.surf2, border: `2px solid ${T.bdr2}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.serif, fontSize: 22, color: "#4da8ff" }}>{session?.user?.name?.[0] ?? "?"}</div>
        }
        <div>
          <div style={{ fontFamily: T.serif, fontSize: 20, color: T.text, marginBottom: 4 }}>{session?.user?.name ?? "—"}</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.meta, letterSpacing: "0.06em" }}>{session?.user?.email ?? ""}</div>
        </div>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.meta, letterSpacing: "0.06em", marginBottom: 8 }}>SIGN IN PROVIDER</div>
      <div style={{ fontFamily: T.sans, fontSize: 13, color: T.body, marginBottom: 24 }}>
        {session?.user?.email?.includes("github") ? "GitHub" : "Google"} OAuth — account linked at sign-in.
      </div>
      <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ padding: "8px 16px", borderRadius: 6, background: "#ff5a5a18", border: "1px solid #ff5a5a44", color: "#ff5a5a", fontFamily: T.mono, fontSize: 10, letterSpacing: "0.08em", cursor: "pointer" }}>
        SIGN OUT
      </button>
    </div>
  );
}

function SharingSection() {
  return (
    <div style={{ maxWidth: 520 }}>
      <p style={{ fontFamily: T.sans, fontSize: 13.5, color: T.body, lineHeight: 1.7, marginBottom: 24 }}>
        Review links give read-only access to a specific room's conversation for 72 hours. Generate them from inside any room via <span style={{ fontFamily: T.mono, color: T.text }}>⌘K → Share review link</span>.
      </p>
      <div style={{ padding: "14px 16px", background: T.surf, border: `1px solid ${T.bdr}`, borderRadius: 6, fontFamily: T.mono, fontSize: 10, color: T.sub, letterSpacing: "0.06em", lineHeight: 1.6 }}>
        THE CAST DOES NOT HAVE WRITE ACCESS BY DEFAULT · WHEN @SCHEDULER PROPOSES AN EVENT, YOU CONFIRM THE WRITE IN CHAT · REVOKING A REVIEW LINK DOES NOT DELETE ANY ROOM HISTORY
      </div>
    </div>
  );
}

function PrivacySection() {
  return (
    <div style={{ maxWidth: 520 }}>
      <p style={{ fontFamily: T.sans, fontSize: 13.5, color: T.body, lineHeight: 1.7, marginBottom: 24 }}>
        Your room conversations and artifacts are stored in your Supabase instance. No data is shared with third parties beyond the Anthropic API calls required for agent responses.
      </p>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.meta, letterSpacing: "0.06em", marginBottom: 8 }}>DATA RETENTION</div>
      <p style={{ fontFamily: T.sans, fontSize: 13, color: T.body, lineHeight: 1.65 }}>
        Messages and artifacts persist until you delete them. Deleting a room permanently removes all messages, artifacts, and review links for that room.
      </p>
    </div>
  );
}

function KeyboardSection() {
  const shortcuts = [
    ["⌘K", "Open command palette"],
    ["⌘1–5", "Fire agent by position"],
    ["Tab", "Cycle through agents in composer"],
    ["Enter", "Send message"],
    ["Shift+Enter", "New line in composer"],
    ["Escape", "Close modal / palette"],
    ["⌘Z", "Undo last clear (not available)"],
  ];
  return (
    <div style={{ maxWidth: 460 }}>
      {shortcuts.map(([key, desc]) => (
        <div key={key} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 16, padding: "9px 0", borderBottom: `1px solid ${T.bdr}` }}>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.text, letterSpacing: "0.04em", padding: "2px 8px", background: T.surf, border: `1px solid ${T.bdr2}`, borderRadius: 4, display: "inline-block", textAlign: "center" }}>{key}</span>
          <span style={{ fontFamily: T.sans, fontSize: 13, color: T.body, alignSelf: "center" }}>{desc}</span>
        </div>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("Integrations");

  const connectedCount = INTEGRATIONS.filter(i => i.connected).length;
  const availableCount = INTEGRATIONS.filter(i => !i.connected).length;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.sans, display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&family=DM+Serif+Display:ital@0;1&family=Source+Serif+Pro:ital,wght@0,400;1,400&display=swap'); *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${T.bdr2}; border-radius: 2px; }`}</style>

      {/* Top bar */}
      <div style={{ height: 52, padding: "0 24px", borderBottom: `1px solid ${T.bdr}`, background: T.bg2, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={() => router.push("/rooms")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: T.mono, fontSize: 10, color: T.meta, letterSpacing: "0.1em", padding: "4px 8px", borderRadius: 4 }}
          onMouseEnter={e => (e.currentTarget.style.color = T.sub)} onMouseLeave={e => (e.currentTarget.style.color = T.meta)}>
          ← ROOMS
        </button>
        <div style={{ width: 1, height: 14, background: T.bdr2 }} />
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.meta, letterSpacing: "0.12em" }}>SETTINGS</span>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Left nav */}
        <div style={{ width: 200, background: T.bg2, borderRight: `1px solid ${T.bdr}`, padding: "20px 14px", flexShrink: 0 }}>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.meta, letterSpacing: "0.14em", marginBottom: 10, padding: "0 8px" }}>SETTINGS</div>
          {NAV_SECTIONS.map(section => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              style={{
                width: "100%", display: "block", padding: "7px 10px",
                background: "transparent",
                border: "none",
                borderLeft: activeSection === section ? `2px solid #c89cff` : `2px solid transparent`,
                fontFamily: T.sans, fontSize: 12.5,
                color: activeSection === section ? T.text : T.body,
                fontWeight: activeSection === section ? 500 : 400,
                cursor: "pointer", textAlign: "left",
                marginBottom: 2,
              }}
            >
              {section}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px 60px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6 }}>
            <h1 style={{ fontFamily: T.serif, fontSize: 24, fontWeight: 400, color: T.text }}>{activeSection}</h1>
            {activeSection === "Integrations" && (
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.meta, letterSpacing: "0.08em" }}>
                {connectedCount} CONNECTED · {availableCount} AVAILABLE
              </span>
            )}
          </div>

          {activeSection === "Integrations" && (
            <>
              <p style={{ fontFamily: T.serif, fontSize: 14, color: T.body, lineHeight: 1.6, marginBottom: 24, maxWidth: 640 }}>
                The cast can read from these and, where allowed, write back. Nothing is touched without you confirming the action in chat.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 760 }}>
                {INTEGRATIONS.map(int => <IntegrationCard key={int.name} int={int} />)}
              </div>
              <div style={{ marginTop: 24, padding: "12px 16px", background: T.surf, border: `1px solid ${T.bdr}`, borderRadius: 4, fontFamily: T.mono, fontSize: 10, color: T.sub, letterSpacing: "0.06em", lineHeight: 1.6, maxWidth: 760 }}>
                THE CAST DOES NOT HAVE WRITE ACCESS BY DEFAULT · WHEN @SCHEDULER PROPOSES AN EVENT, YOU CONFIRM THE WRITE IN CHAT · REVOKE ANY INTEGRATION ABOVE WITHOUT LOSING ROOM HISTORY
              </div>
            </>
          )}

          {activeSection === "Profile" && <ProfileSection session={session} />}
          {activeSection === "Sharing & links" && <SharingSection />}
          {activeSection === "Privacy & retention" && <PrivacySection />}
          {activeSection === "Keyboard shortcuts" && <KeyboardSection />}
        </div>
      </div>
    </div>
  );
}
