"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PERSONAS, PERSONA_LIST, parseMentions } from "@/lib/personas";
import type { Message, Room, PersonaId } from "@/types";

interface Props {
  room: Room;
  currentUser: { id: string; name: string; image: string | null };
  userRole: "owner" | "member";
}

export default function WritersRoom({ room, currentUser, userRole }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [mentionQuery, setMentionQuery] = useState<{ query: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load message history
  useEffect(() => {
    fetch(`/api/messages?roomId=${room.id}`)
      .then(r => r.json())
      .then(data => {
        setMessages(data.map((m: any) => ({
          ...m,
          user_name: m.profiles?.name ?? "User",
          user_avatar: m.profiles?.avatar_url ?? null,
        })));
        setLoadingHistory(false);
      });
  }, [room.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function now() {
    return new Date().toISOString();
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const mentionMatch = before.match(/@(\w*)$/);
    setMentionQuery(mentionMatch ? { query: mentionMatch[1] } : null);
  };

  const completeMention = (personaHandle: string) => {
    if (!inputRef.current) return;
    const cursor = inputRef.current.selectionStart;
    const before = input.slice(0, cursor);
    const after = input.slice(cursor);
    setInput(before.replace(/@\w*$/, `@${personaHandle} `) + after);
    setMentionQuery(null);
    inputRef.current.focus();
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || Object.keys(loading).length > 0) return;
    setInput("");
    setMentionQuery(null);

    // Save user message to DB
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: room.id, content: text }),
    });
    const saved = await res.json();

    const userMsg: Message = {
      ...saved,
      role: "user",
      user_name: currentUser.name,
      user_avatar: currentUser.image,
    };
    setMessages(prev => [...prev, userMsg]);

    const mentions = parseMentions(text);
    if (!mentions.length) return;

    const newLoading: Record<string, boolean> = {};
    mentions.forEach(id => { newLoading[id] = true; });
    setLoading(newLoading);

    // Build history snapshot for context
    const historySnapshot = [...messages, userMsg].map(m => ({
      role: m.role,
      persona: m.persona,
      content: m.content,
      user_name: m.user_name,
    }));

    // Call agents sequentially so each sees previous responses
    for (const personaId of mentions) {
      try {
        const agentRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personaId,
            userMessage: text,
            roomId: room.id,
            history: historySnapshot,
          }),
        });
        const { text: agentText } = await agentRes.json();
        const agentMsg: Message = {
          id: `${Date.now()}-${personaId}`,
          role: "agent",
          persona: personaId as PersonaId,
          content: agentText,
          created_at: now(),
        };
        setMessages(prev => [...prev, agentMsg]);
        historySnapshot.push({ role: "agent", persona: personaId, content: agentText, user_name: undefined });
      } catch {
        // silently skip failed agents
      }
      setLoading(prev => { const n = { ...prev }; delete n[personaId]; return n; });
    }
  }, [input, loading, messages, room.id, currentUser]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (mentionQuery) return;
      send();
    }
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(room.invite_code ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      const match = part.match(/^@(\w+)$/);
      if (match && PERSONAS[match[1].toLowerCase() as PersonaId]) {
        const p = PERSONAS[match[1].toLowerCase() as PersonaId];
        return <span key={i} style={{ color: p.color, fontWeight: 600 }}>{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const mentionOptions = PERSONA_LIST.filter(p =>
    !mentionQuery || p.handle.startsWith(mentionQuery.query.toLowerCase())
  );

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5",
      fontFamily: "var(--font-sans)", display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 24px", borderBottom: "1px solid #1e1e1e", background: "#0d0d0d",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button onClick={() => router.push("/rooms")} style={{
            background: "none", border: "none", color: "#555", fontSize: "18px", padding: "0 4px",
          }}>←</button>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#e5e5e5" }}>{room.name}</div>
            {room.description && <div style={{ fontSize: "11px", color: "#555" }}>{room.description}</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {room.invite_code && (
            <button onClick={copyInvite} style={{
              background: "none", border: "1px solid #2a2a2a", color: copied ? "#34d399" : "#555",
              padding: "4px 12px", borderRadius: "6px", fontSize: "11px",
              fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
            }}>
              {copied ? "COPIED!" : `INVITE: ${room.invite_code}`}
            </button>
          )}
        </div>
      </div>

      {/* Agent strip */}
      <div style={{
        padding: "8px 24px", background: "#0d0d0d", borderBottom: "1px solid #161616",
        display: "flex", gap: "6px", flexWrap: "wrap",
      }}>
        {PERSONA_LIST.map(p => (
          <button
            key={p.id}
            onClick={() => { setInput(prev => prev + `@${p.handle} `); inputRef.current?.focus(); }}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "3px 8px 3px 5px", borderRadius: "20px",
              background: p.accent + "80", border: `1px solid ${p.color}20`,
              fontSize: "11px", fontFamily: "var(--font-mono)", cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = p.color + "60")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = p.color + "20")}
          >
            <span style={{ color: p.color }}>{p.icon}</span>
            <span style={{ color: p.color + "cc", letterSpacing: "0.06em" }}>@{p.handle}</span>
          </button>
        ))}
        {loading && Object.keys(loading).length > 0 && (
          <span style={{ fontSize: "10px", color: "#444", fontFamily: "var(--font-mono)", alignSelf: "center", marginLeft: "auto" }}>
            {Object.keys(loading).join(", ")} thinking...
          </span>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflow: "auto", padding: "20px 24px",
        display: "flex", flexDirection: "column", gap: "6px",
      }}>
        {loadingHistory && (
          <p style={{ color: "#333", fontFamily: "var(--font-mono)", fontSize: "11px", textAlign: "center" }}>
            Loading history...
          </p>
        )}

        {messages.map(msg => {
          if (msg.role === "user") {
            const isMe = msg.user_id === currentUser.id;
            return (
              <div key={msg.id} className="msg-in" style={{
                display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", gap: "8px",
                alignItems: "flex-end",
              }}>
                {!isMe && msg.user_avatar && (
                  <img src={msg.user_avatar} alt="" style={{ width: "22px", height: "22px", borderRadius: "50%", border: "1px solid #2a2a2a", flexShrink: 0 }} />
                )}
                <div style={{
                  maxWidth: "70%", background: isMe ? "#1c1c1c" : "#161616",
                  border: `1px solid ${isMe ? "#333" : "#2a2a2a"}`,
                  borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  padding: "10px 14px",
                }}>
                  {!isMe && <div style={{ fontSize: "10px", color: "#555", marginBottom: "3px", fontFamily: "var(--font-mono)" }}>{msg.user_name}</div>}
                  <div style={{ fontSize: "14px", color: "#e5e5e5", lineHeight: "1.55", whiteSpace: "pre-wrap" }}>
                    {renderContent(msg.content)}
                  </div>
                  <div style={{ fontSize: "10px", color: "#444", marginTop: "4px", textAlign: isMe ? "right" : "left", fontFamily: "var(--font-mono)" }}>
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              </div>
            );
          }

          if (msg.role === "agent" && msg.persona) {
            const persona = PERSONAS[msg.persona];
            return (
              <div key={msg.id} className="msg-in" style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "6px", flexShrink: 0,
                  background: persona.accent, border: `1px solid ${persona.color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", color: persona.color,
                }}>
                  {persona.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "baseline", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", color: persona.color, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", fontWeight: 600 }}>
                      {persona.name.toUpperCase()}
                    </span>
                    <span style={{ fontSize: "10px", color: "#333", fontFamily: "var(--font-mono)" }}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  <div style={{
                    background: "#111", border: "1px solid #222",
                    borderLeft: `3px solid ${persona.color}50`,
                    borderRadius: "0 8px 8px 0", padding: "10px 14px",
                    fontSize: "14px", color: "#d4d4d4", lineHeight: "1.65", whiteSpace: "pre-wrap",
                  }}>
                    {renderContent(msg.content)}
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* Typing indicators */}
        {Object.keys(loading).map(personaId => {
          const persona = PERSONAS[personaId as PersonaId];
          return (
            <div key={`typing-${personaId}`} className="msg-in" style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "6px", flexShrink: 0,
                background: persona.accent, border: `1px solid ${persona.color}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", color: persona.color,
              }}>
                {persona.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", color: persona.color, fontFamily: "var(--font-mono)", marginBottom: "4px", letterSpacing: "0.08em" }}>
                  {persona.name.toUpperCase()}
                </div>
                <div style={{
                  background: "#141414", border: "1px solid #2a2a2a", borderRadius: "8px",
                  padding: "10px 14px", display: "inline-flex", gap: "5px", alignItems: "center",
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: "5px", height: "5px", borderRadius: "50%", background: persona.color,
                      animation: "bounce 1.2s ease-in-out infinite",
                      animationDelay: `${i * 0.2}s`, opacity: 0.7,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "16px 24px", borderTop: "1px solid #1e1e1e", background: "#0d0d0d" }}>
        <div style={{ position: "relative" }}>
          {mentionQuery !== null && mentionOptions.length > 0 && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 8px)", left: 0,
              background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px",
              overflow: "hidden", zIndex: 100, minWidth: "180px",
              boxShadow: "0 -4px 20px rgba(0,0,0,0.5)",
            }}>
              {mentionOptions.map(p => (
                <div key={p.id} onClick={() => completeMention(p.handle)} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "8px 12px", cursor: "pointer",
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#252525")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{
                    width: "22px", height: "22px", borderRadius: "4px",
                    background: p.accent, border: `1px solid ${p.color}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "11px", color: p.color,
                  }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: "13px", color: "#e5e5e5" }}>@{p.handle}</div>
                    <div style={{ fontSize: "10px", color: "#666", fontFamily: "var(--font-mono)" }}>{p.name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{
            display: "flex", gap: "10px", alignItems: "flex-end",
            background: "#111", border: "1px solid #252525", borderRadius: "10px",
            padding: "10px 14px",
          }}>
            {currentUser.image && (
              <img src={currentUser.image} alt="" style={{ width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0, alignSelf: "flex-end", marginBottom: "3px" }} />
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={onKeyDown}
              placeholder="Type @ to call an agent..."
              rows={1}
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                color: "#e5e5e5", fontSize: "14px", lineHeight: "1.5",
                maxHeight: "120px", overflow: "auto", paddingTop: "2px",
                caretColor: "#60a5fa", resize: "none",
              }}
              onInput={(e: any) => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || Object.keys(loading).length > 0}
              style={{
                background: Object.keys(loading).length > 0 ? "#1a1a1a" : "#1d3461",
                border: `1px solid ${Object.keys(loading).length > 0 ? "#222" : "#2d4f8a"}`,
                color: Object.keys(loading).length > 0 ? "#333" : "#60a5fa",
                width: "34px", height: "34px", borderRadius: "7px",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, fontSize: "16px", cursor: "pointer",
              }}
            >
              {Object.keys(loading).length > 0 ? "·" : "↑"}
            </button>
          </div>
          <div style={{ marginTop: "6px", fontSize: "10px", color: "#333", fontFamily: "var(--font-mono)", display: "flex", justifyContent: "space-between" }}>
            <span>↵ send · shift+↵ newline · click agent chips above to add mention</span>
            <span>{messages.length} messages in session</span>
          </div>
        </div>
      </div>
    </div>
  );
}
