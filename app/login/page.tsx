"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

const T = {
  bg:   "#0a0a0a",
  surf: "#111111",
  bdr:  "#1e1e1e",
  bdr2: "#2a2a2a",
  text: "#dcdcdc",
  sub:  "#888888",
  meta: "#555555",
  mono: "'IBM Plex Mono', monospace",
  sans: "'IBM Plex Sans', sans-serif",
} as const;

const AGENTS = [
  { icon: "◈", color: "#34d399", handle: "researcher" },
  { icon: "✦", color: "#60a5fa", handle: "writer"     },
  { icon: "⌘", color: "#fbbf24", handle: "editor"     },
  { icon: "⚡", color: "#f87171", handle: "critic"     },
  { icon: "◎", color: "#c084fc", handle: "director"   },
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
      fontFamily: T.sans, padding: "24px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease both; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 380 }}>

        {/* ── Hero ── */}
        <div className="fade-up" style={{ textAlign: "center", marginBottom: 36 }}>
          {/* Agent row */}
          <div style={{ display: "flex", justifyContent: "center", gap: 18, marginBottom: 28 }}>
            {AGENTS.map((a, i) => (
              <div key={i} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                animationDelay: `${i * 60}ms`,
              }} className="fade-up">
                <span style={{ fontSize: 26, color: a.color, lineHeight: 1, display: "block" }}>
                  {a.icon}
                </span>
                <span style={{
                  fontFamily: T.mono, fontSize: 7, color: a.color + "55",
                  letterSpacing: "0.08em",
                }}>
                  @{a.handle.slice(0, 5)}
                </span>
              </div>
            ))}
          </div>

          <h1 style={{
            fontSize: 24, fontWeight: 500, color: T.text,
            letterSpacing: "0.01em", marginBottom: 10, fontFamily: T.sans,
          }}>
            Writers Room
          </h1>
          <p style={{
            fontSize: 13, color: T.sub, lineHeight: 1.65, fontFamily: T.sans,
          }}>
            A collaborative space for writers and&nbsp;AI&nbsp;agents
          </p>
        </div>

        {/* ── Login card ── */}
        <div className="fade-up" style={{
          background: T.surf, border: `1px solid ${T.bdr}`,
          borderRadius: 12, padding: "28px 28px 22px",
          animationDelay: "180ms",
        }}>
          <p style={{
            fontFamily: T.mono, fontSize: 9, color: T.meta,
            letterSpacing: "0.16em", marginBottom: 18, textAlign: "center",
          }}>
            SIGN IN TO CONTINUE
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Google */}
            <button
              onClick={() => handleSignIn("google")}
              disabled={loading !== null}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "12px 16px", borderRadius: 8,
                background: loading === "google" ? "#e8e8e8" : "#ffffff",
                border: "none", color: "#1a1a1a",
                fontSize: 14, fontWeight: 500, fontFamily: T.sans,
                cursor: loading !== null ? "wait" : "pointer",
                opacity: loading !== null && loading !== "google" ? 0.45 : 1,
                transition: "opacity 0.15s, background 0.15s",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.opacity = "1"; }}
            >
              {loading === "google" ? (
                <span style={{ fontFamily: T.mono, fontSize: 11, color: "#666" }}>Redirecting…</span>
              ) : (
                <>
                  <GoogleIcon />
                  Continue with Google
                </>
              )}
            </button>

            {/* GitHub */}
            <button
              onClick={() => handleSignIn("github")}
              disabled={loading !== null}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "12px 16px", borderRadius: 8,
                background: "#24292e", border: "1px solid #444",
                color: "#ffffff", fontSize: 14, fontWeight: 500, fontFamily: T.sans,
                cursor: loading !== null ? "wait" : "pointer",
                opacity: loading !== null && loading !== "github" ? 0.45 : 1,
                transition: "opacity 0.15s, background 0.15s",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#2d333b"; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#24292e"; }}
            >
              {loading === "github" ? (
                <span style={{ fontFamily: T.mono, fontSize: 11, color: "#aaa" }}>Redirecting…</span>
              ) : (
                <>
                  <GitHubIcon />
                  Continue with GitHub
                </>
              )}
            </button>
          </div>

          <p style={{
            marginTop: 20, textAlign: "center",
            fontSize: 11, color: T.meta,
            fontFamily: T.mono, lineHeight: 1.6,
          }}>
            Sign in to access your rooms
          </p>
        </div>

        {/* ── Tagline row ── */}
        <div className="fade-up" style={{
          marginTop: 28, display: "flex", justifyContent: "center",
          gap: 0, animationDelay: "280ms",
        }}>
          {["Research", "Write", "Edit", "Critique", "Direct"].map((label, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 0,
            }}>
              <span style={{
                fontFamily: T.mono, fontSize: 9,
                color: i === 2 ? T.sub : T.meta,
                padding: "0 8px",
                borderRight: i < 4 ? `1px solid ${T.bdr}` : "none",
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
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
