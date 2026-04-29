"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

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

const AGENTS = [
  { icon: "◈", color: "#0fe898", id: "researcher" },
  { icon: "✦", color: "#4da8ff", id: "writer"     },
  { icon: "⌘", color: "#ffca00", id: "editor"     },
  { icon: "⚡", color: "#ff5a5a", id: "critic"     },
  { icon: "◎", color: "#c89cff", id: "director"   },
];

const FEATURES: [string, string, string][] = [
  ["◬", "#e879f9", "Worldbuilding rooms with persistent canon"],
  ["✦", "#4da8ff", "Real drafts, not suggestions — from a Writer who actually writes"],
  ["◎", "#c89cff", "Director synthesizes every exchange and names the next move"],
  ["↗", "#8a8a92", "NotebookLM Lore Pack export + Google Drive"],
];

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSignIn = (provider: string) => {
    setLoading(provider);
    signIn(provider, { callbackUrl: "/rooms" });
  };

  return (
    <div style={{
      minHeight: "100vh", background: T.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: T.sans, padding: "32px 24px",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&family=DM+Serif+Display:ital@0;1&family=Source+Serif+Pro:ital,wght@0,400;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.5s ease both; }
      `}</style>

      {/* Ambient grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `linear-gradient(${T.bdr} 1px, transparent 1px), linear-gradient(90deg, ${T.bdr} 1px, transparent 1px)`,
        backgroundSize: "48px 48px", opacity: 0.18, pointerEvents: "none",
      }} />

      <div className="fade-up" style={{
        position: "relative", zIndex: 1, width: "100%", maxWidth: 900,
        display: "grid", gridTemplateColumns: "1.2fr 1fr",
        gap: 56, alignItems: "center",
      }}>

        {/* ── Left: pitch ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {AGENTS.map(a => (
                <span key={a.id} style={{ color: a.color, fontSize: 16, lineHeight: 1 }}>{a.icon}</span>
              ))}
            </div>
            <div style={{ width: 1, height: 14, background: T.bdr2 }} />
            <span style={{ fontFamily: T.mono, fontSize: 9, color: T.meta, letterSpacing: "0.14em" }}>WRITERS ROOM</span>
          </div>

          <h1 style={{
            fontFamily: T.serif, fontSize: 56, lineHeight: 1.05,
            letterSpacing: "-0.025em", color: T.text,
            marginBottom: 18, fontWeight: 400,
          }}>
            Five voices.<br />
            <em style={{ fontStyle: "italic", color: "#4da8ff" }}>One room.</em>
          </h1>

          <p style={{ fontSize: 15, color: T.sub, lineHeight: 1.7, maxWidth: 390, marginBottom: 32 }}>
            A Researcher to ground you. A Writer who actually drafts. An Editor who tightens. A Critic who pushes back. A Director who synthesizes and names the next move.
          </p>

          {/* Director preview card */}
          <div style={{
            padding: "14px 16px",
            background: "#c89cff0f", border: "1px solid #c89cff44",
            borderLeft: "2px solid #c89cff", borderRadius: "0 6px 6px 0",
            maxWidth: 430,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ color: "#c89cff", fontSize: 13 }}>◎</span>
              <span style={{ fontFamily: T.mono, fontSize: 8, color: "#c89cffaa", letterSpacing: "0.1em" }}>@director · LIVE PREVIEW</span>
            </div>
            <p style={{
              fontFamily: T.italic, fontSize: 14, fontStyle: "italic",
              color: T.body, lineHeight: 1.65, margin: 0,
            }}>
              "The Researcher grounds us in what's verified. The Writer drafts a real version. The Critic finds the three weakest points. Taking it all together — here's the next move."
            </p>
          </div>
        </div>

        {/* ── Right: sign-in card ── */}
        <div className="fade-up" style={{
          background: T.surf, border: `1px solid ${T.bdr2}`,
          borderRadius: 12, padding: "28px 28px 22px",
          animationDelay: "120ms",
        }}>
          <p style={{
            fontFamily: T.mono, fontSize: 9, color: T.meta,
            letterSpacing: "0.16em", marginBottom: 14, textAlign: "center",
          }}>SIGN IN TO CONTINUE</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <button
              onClick={() => handleSignIn("google")}
              disabled={loading !== null}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "13px 16px", borderRadius: 8,
                background: loading === "google" ? "#e8e8e8" : "#ffffff",
                border: "none", color: "#1a1a1a",
                fontSize: 14, fontWeight: 500, fontFamily: T.sans,
                cursor: loading !== null ? "wait" : "pointer",
                opacity: loading !== null && loading !== "google" ? 0.4 : 1,
                transition: "opacity 0.15s, background 0.15s",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.opacity = "1"; }}
            >
              {loading === "google"
                ? <span style={{ fontFamily: T.mono, fontSize: 11, color: "#666" }}>Redirecting…</span>
                : <><GoogleIcon />Continue with Google</>}
            </button>

            <button
              onClick={() => handleSignIn("github")}
              disabled={loading !== null}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "13px 16px", borderRadius: 8,
                background: "#24292e", border: "1px solid #3a3a3a",
                color: "#ffffff", fontSize: 14, fontWeight: 500, fontFamily: T.sans,
                cursor: loading !== null ? "wait" : "pointer",
                opacity: loading !== null && loading !== "github" ? 0.4 : 1,
                transition: "opacity 0.15s, background 0.15s",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#2d333b"; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#24292e"; }}
            >
              {loading === "github"
                ? <span style={{ fontFamily: T.mono, fontSize: 11, color: "#aaa" }}>Redirecting…</span>
                : <><GitHubIcon />Continue with GitHub</>}
            </button>
          </div>

          <div style={{ height: 1, background: T.bdr, margin: "20px 0" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FEATURES.map(([icon, color, text]) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: T.sub }}>
                <span style={{ color, fontSize: 13, width: 14, flexShrink: 0 }}>{icon}</span>
                {text}
              </div>
            ))}
          </div>

          <p style={{
            marginTop: 20, fontFamily: T.mono, fontSize: 9,
            color: T.faint, textAlign: "center", letterSpacing: "0.1em",
          }}>BY SIGNING IN YOU AGREE TO TERMS · PRIVACY</p>
        </div>
      </div>

      {/* Mobile: hide the pitch column */}
      <style>{`@media(max-width:700px){.login-cols{grid-template-columns:1fr!important}.login-pitch{display:none!important}}`}</style>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  );
}
