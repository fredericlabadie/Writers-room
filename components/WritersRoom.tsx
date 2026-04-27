"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { PERSONAS, PERSONA_LIST, parseMentions } from "@/lib/personas";
import type { Artifact, Message, RetrievalMode, Room, PersonaId, RoomSection } from "@/types";

interface GeneratedFile {
  filename: string;
  ext: string;
  content: string;
}

const GENERATED_FILE_BLOCK_RE = /```file:([^\n`]+)\n([\s\S]*?)```/g;
const TOUR_SEEN_KEY = "writers-room-tour-seen-v1";
const NOTEBOOK_LM_LINK_KEY_PREFIX = "writers-room-notebooklm-link-";
const NOTEBOOK_LM_UNSYNCED_KEY_PREFIX = "writers-room-notebooklm-unsynced-";
const NOTEBOOK_LM_LAST_SYNC_KEY_PREFIX = "writers-room-notebooklm-last-sync-";
const LORE_MESSAGE_THRESHOLD = 8;
const TOUR_STEPS = [
  {
    title: "Welcome to your story studio",
    body: "Write in plain language about your novel, setting, characters, or plot. Mention helpers only when you want specialist support.",
  },
  {
    title: "Story section tone (optional)",
    body: "Create a section like Chapter 1, Faction Lore, or Character Arc. Add a Spotify track to shape voice, pacing, and atmosphere.",
  },
  {
    title: "Lore vault",
    body: "Open FILES to upload your world bible, character notes, timelines, and research. This grounds AI responses in your canon.",
  },
  {
    title: "Lore retrieval settings",
    body: "Whole lore vault checks every source. Selected sources checks only what you tick. ADVANCED gives finer control when needed.",
  },
  {
    title: "NotebookLM bridge",
    body: "Save your NotebookLM URL, then export a Lore Pack from this room. Upload that pack into NotebookLM to keep long-term memory organized.",
  },
  {
    title: "Download writing outputs",
    body: "Ask for outlines, chapter drafts, world entries, and planning tables. Use DOWNLOAD or XLSX to keep reusable files.",
  },
];

function getFileExt(filename: string) {
  const parts = filename.split(".");
  return (parts.length > 1 ? parts[parts.length - 1] : "txt").toLowerCase();
}

function parseGeneratedFiles(content: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  let match;
  while ((match = GENERATED_FILE_BLOCK_RE.exec(content)) !== null) {
    const rawName = match[1].trim();
    const safeName = rawName.replace(/[^\w.\-]/g, "_");
    const text = match[2].replace(/\n$/, "");
    files.push({
      filename: safeName || `generated-${Date.now()}.txt`,
      ext: getFileExt(safeName || "txt"),
      content: text,
    });
  }
  GENERATED_FILE_BLOCK_RE.lastIndex = 0;
  return files;
}

function stripGeneratedFileBlocks(content: string) {
  return content.replace(GENERATED_FILE_BLOCK_RE, "").trim();
}

interface Props {
  room: Room;
  currentUser: { id: string; name: string; image: string | null };
  userRole: "owner" | "member";
  reviewScope?: { read: boolean; write: boolean } | null;
}

export default function WritersRoom({ room, currentUser, userRole, reviewScope = null }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [sections, setSections] = useState<RoomSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [newSectionName, setNewSectionName] = useState("");
  const [sectionSpotifyUrl, setSectionSpotifyUrl] = useState("");
  const [sectionMoodBusy, setSectionMoodBusy] = useState(false);
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<string[]>([]);
  const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>("room_wide");
  const [retrievalTopK, setRetrievalTopK] = useState(6);
  const [retrievalThreshold, setRetrievalThreshold] = useState(0.14);
  const [showRetrievalSettings, setShowRetrievalSettings] = useState(false);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const [uploadingArtifact, setUploadingArtifact] = useState(false);
  const [loadingChunksArtifactId, setLoadingChunksArtifactId] = useState<string | null>(null);
  const [openChunksArtifactId, setOpenChunksArtifactId] = useState<string | null>(null);
  const [artifactChunks, setArtifactChunks] = useState<Record<string, Array<{ id: string; chunk_index: number; content: string }>>>({});
  const [reindexingArtifactId, setReindexingArtifactId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [postingMessage, setPostingMessage] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [mentionQuery, setMentionQuery] = useState<{ query: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [artifactError, setArtifactError] = useState("");
  const [sectionError, setSectionError] = useState("");
  const [notebookLmUrl, setNotebookLmUrl] = useState("");
  const [notebookStatus, setNotebookStatus] = useState("");
  const [showNotebookGuide, setShowNotebookGuide] = useState(false);
  const [notebookGuideCopied, setNotebookGuideCopied] = useState(false);
  const [unsyncedLoreChanges, setUnsyncedLoreChanges] = useState(0);
  const [messagesSinceLoreSync, setMessagesSinceLoreSync] = useState(0);
  const [lastLoreSyncAt, setLastLoreSyncAt] = useState("");
  const [showTourPrompt, setShowTourPrompt] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStepIdx, setTourStepIdx] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const artifactInputRef = useRef<HTMLInputElement>(null);
  const readOnlyReview = !!reviewScope?.read && !reviewScope?.write;
  const ownerCanMaintainArtifacts = userRole === "owner" && !readOnlyReview;

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

    fetch(`/api/artifacts?roomId=${room.id}`)
      .then(r => r.json())
      .then((data) => {
        if (Array.isArray(data)) setArtifacts(data);
      });

    fetch(`/api/sections?roomId=${room.id}`)
      .then(r => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSections(data);
      });
  }, [room.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (readOnlyReview) return;
    try {
      const hasSeenTour = localStorage.getItem(TOUR_SEEN_KEY) === "true";
      if (!hasSeenTour) setShowTourPrompt(true);
    } catch {
      // localStorage may be unavailable in restricted environments
    }
  }, [readOnlyReview]);

  useEffect(() => {
    if (readOnlyReview) return;
    try {
      const stored = localStorage.getItem(`${NOTEBOOK_LM_LINK_KEY_PREFIX}${room.id}`) ?? "";
      setNotebookLmUrl(stored);
      const storedUnsynced = Number(localStorage.getItem(`${NOTEBOOK_LM_UNSYNCED_KEY_PREFIX}${room.id}`) ?? "0");
      setUnsyncedLoreChanges(Number.isFinite(storedUnsynced) ? Math.max(0, storedUnsynced) : 0);
      const storedLastSync = localStorage.getItem(`${NOTEBOOK_LM_LAST_SYNC_KEY_PREFIX}${room.id}`) ?? "";
      setLastLoreSyncAt(storedLastSync);
    } catch {
      // localStorage may be unavailable
    }
  }, [room.id, readOnlyReview]);

  function now() {
    return new Date().toISOString();
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const pushSystemMessage = (text: string) => {
    const sysMsg: Message = {
      id: `system-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: "system",
      content: text,
      created_at: now(),
    };
    setMessages((prev) => [...prev, sysMsg]);
  };

  const markTourSeen = () => {
    try {
      localStorage.setItem(TOUR_SEEN_KEY, "true");
    } catch {
      // noop
    }
  };

  const startTour = () => {
    setShowTourPrompt(false);
    setTourStepIdx(0);
    setTourOpen(true);
    markTourSeen();
  };

  const skipTour = () => {
    setShowTourPrompt(false);
    setTourOpen(false);
    markTourSeen();
  };

  const saveNotebookLmLink = () => {
    if (readOnlyReview) return;
    const trimmed = notebookLmUrl.trim();
    try {
      localStorage.setItem(`${NOTEBOOK_LM_LINK_KEY_PREFIX}${room.id}`, trimmed);
      setNotebookStatus(trimmed ? "NotebookLM link saved for this room." : "NotebookLM link cleared.");
      setTimeout(() => setNotebookStatus(""), 2400);
    } catch {
      setNotebookStatus("Could not save NotebookLM link in this browser.");
      setTimeout(() => setNotebookStatus(""), 2400);
    }
  };

  const persistLoreSyncMeta = (unsyncedCount: number, lastSyncIso?: string) => {
    try {
      localStorage.setItem(`${NOTEBOOK_LM_UNSYNCED_KEY_PREFIX}${room.id}`, String(Math.max(0, unsyncedCount)));
      if (lastSyncIso !== undefined) {
        localStorage.setItem(`${NOTEBOOK_LM_LAST_SYNC_KEY_PREFIX}${room.id}`, lastSyncIso);
      }
    } catch {
      // localStorage may be unavailable
    }
  };

  const registerLoreChange = () => {
    setUnsyncedLoreChanges((prev) => {
      const next = prev + 1;
      persistLoreSyncMeta(next);
      return next;
    });
  };

  const markLoreSynced = (statusText = "Lore sync marked complete.") => {
    const nowIso = new Date().toISOString();
    setUnsyncedLoreChanges(0);
    setMessagesSinceLoreSync(0);
    setLastLoreSyncAt(nowIso);
    persistLoreSyncMeta(0, nowIso);
    setNotebookStatus(statusText);
    setTimeout(() => setNotebookStatus(""), 2400);
  };

  const buildLorePack = () => {
    const sectionLines = sections.length
      ? sections.map((section) => {
        const moodLabel = section.mood_profile?.moodLabel ? ` | mood: ${section.mood_profile.moodLabel}` : "";
        const moodGuidance = section.mood_profile?.guidance ? `\n  guidance: ${section.mood_profile.guidance}` : "";
        return `- ${section.name}${moodLabel}${moodGuidance}`;
      }).join("\n")
      : "- none yet";

    const artifactLines = artifacts.length
      ? artifacts.map((artifact) => `- ${artifact.name} (${artifact.kind}, ${artifact.parse_status})`).join("\n")
      : "- none yet";

    const recentMessages = messages
      .filter((message) => message.role === "user" || message.role === "agent")
      .slice(-60)
      .map((message) => {
        const speaker = message.role === "user"
          ? message.user_name ?? "user"
          : `agent:${message.persona ?? "assistant"}`;
        const sectionTag = message.section_name ? ` [section: ${message.section_name}]` : "";
        return `### ${speaker}${sectionTag}\n${stripGeneratedFileBlocks(message.content).trim() || "(no text)"}`;
      })
      .join("\n\n");

    return [
      `# ${room.name} - Lore Pack`,
      "",
      `Generated: ${new Date().toISOString()}`,
      room.description ? `Room notes: ${room.description}` : "",
      "",
      "## Story World Snapshot",
      sectionLines,
      "",
      "## Lore Sources",
      artifactLines,
      "",
      "## Recent Story Development",
      recentMessages || "_No chat messages yet._",
      "",
      "## Suggested NotebookLM Prompt",
      "Use this lore pack as the canonical world reference. Prioritize consistency across character voice, timeline continuity, faction rules, and setting details.",
      "",
    ].filter(Boolean).join("\n");
  };

  const exportLorePack = () => {
    const content = buildLorePack();
    const safeRoom = room.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "story-world";
    const filename = `${safeRoom}-lore-pack.md`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    markLoreSynced(`Exported ${filename}`);
  };

  const openNotebookLm = () => {
    const url = notebookLmUrl.trim() || "https://notebooklm.google.com/";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const notebookImportPrompt = "Use this lore pack as the canonical world reference. Prioritize consistency across character voice, timeline continuity, faction rules, and setting details.";

  const copyNotebookPrompt = async () => {
    try {
      await navigator.clipboard.writeText(notebookImportPrompt);
      setNotebookGuideCopied(true);
      setTimeout(() => setNotebookGuideCopied(false), 1800);
    } catch {
      setNotebookStatus("Could not copy prompt automatically.");
      setTimeout(() => setNotebookStatus(""), 2200);
    }
  };

  const downloadFile = async (file: GeneratedFile, format: "native" | "xlsx" = "native") => {
    try {
      let blob: Blob;
      let filename = file.filename;

      if (format === "xlsx") {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(file.content, { type: "string" });
        const output = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
        blob = new Blob([output], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        filename = filename.replace(/\.[^.]+$/, "") + ".xlsx";
      } else {
        const type = file.ext === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8";
        blob = new Blob([file.content], { type });
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      setArtifactError("Failed to generate downloadable file");
    }
  };

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

  const toggleArtifactSelection = (artifactId: string) => {
    if (retrievalMode !== "selected_only") return;
    setSelectedArtifactIds((prev) => (
      prev.includes(artifactId)
        ? prev.filter((id) => id !== artifactId)
        : [...prev, artifactId]
    ));
  };

  const handleArtifactUpload = async (file?: File) => {
    if (!file || readOnlyReview) return;
    setUploadingArtifact(true);
    setArtifactError("");
    try {
      const form = new FormData();
      form.append("roomId", room.id);
      form.append("file", file);
      const res = await fetch("/api/artifacts/upload", {
        method: "POST",
        body: form,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Upload failed");
      if (payload.artifact) {
        setArtifacts((prev) => [payload.artifact, ...prev]);
        registerLoreChange();
      }
    } catch (err) {
      setArtifactError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingArtifact(false);
      if (artifactInputRef.current) artifactInputRef.current.value = "";
    }
  };

  const deleteArtifact = async (artifactId: string) => {
    if (!ownerCanMaintainArtifacts) return;
    const res = await fetch(`/api/artifacts/${artifactId}`, { method: "DELETE" });
    if (!res.ok) return;
    setArtifacts((prev) => prev.filter((a) => a.id !== artifactId));
    setSelectedArtifactIds((prev) => prev.filter((id) => id !== artifactId));
    setArtifactChunks((prev) => {
      const next = { ...prev };
      delete next[artifactId];
      return next;
    });
    if (openChunksArtifactId === artifactId) setOpenChunksArtifactId(null);
    registerLoreChange();
  };

  const createSection = async () => {
    const name = newSectionName.trim();
    if (!name || readOnlyReview) return;
    setSectionError("");
    const res = await fetch("/api/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: room.id, name }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setSectionError(payload.error ?? "Failed to create section");
      return;
    }
    setSections((prev) => [...prev, payload]);
    setSelectedSectionId(payload.id);
    setNewSectionName("");
    registerLoreChange();
  };

  const applySpotifyMood = async () => {
    if (!selectedSectionId || !sectionSpotifyUrl.trim() || readOnlyReview) return;
    setSectionMoodBusy(true);
    setSectionError("");
    const res = await fetch(`/api/sections/${selectedSectionId}/mood`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spotifyUrl: sectionSpotifyUrl.trim() }),
    });
    const payload = await res.json();
    setSectionMoodBusy(false);
    if (!res.ok) {
      setSectionError(payload.error ?? "Failed to extract song mood");
      return;
    }
    if (payload.section) {
      setSections((prev) => prev.map((s) => (s.id === payload.section.id ? payload.section : s)));
    }
  };

  const loadArtifactChunks = async (artifactId: string) => {
    if (!ownerCanMaintainArtifacts) return;
    if (openChunksArtifactId === artifactId) {
      setOpenChunksArtifactId(null);
      return;
    }

    if (artifactChunks[artifactId]) {
      setOpenChunksArtifactId(artifactId);
      return;
    }

    setLoadingChunksArtifactId(artifactId);
    const res = await fetch(`/api/artifacts/${artifactId}/chunks`);
    const payload = await res.json();
    setLoadingChunksArtifactId(null);
    if (!res.ok) {
      setArtifactError(payload.error ?? "Failed to load chunks");
      return;
    }
    setArtifactChunks((prev) => ({ ...prev, [artifactId]: payload.chunks ?? [] }));
    setOpenChunksArtifactId(artifactId);
  };

  const reindexArtifact = async (artifactId: string) => {
    if (!ownerCanMaintainArtifacts) return;
    setReindexingArtifactId(artifactId);
    setArtifactError("");
    const res = await fetch(`/api/artifacts/${artifactId}/reindex`, { method: "POST" });
    const payload = await res.json();
    setReindexingArtifactId(null);
    if (!res.ok) {
      setArtifactError(payload.error ?? "Reindex failed");
      return;
    }
    if (payload.artifact) {
      setArtifacts((prev) => prev.map((a) => (a.id === artifactId ? payload.artifact : a)));
    }
    setArtifactChunks((prev) => {
      const next = { ...prev };
      delete next[artifactId];
      return next;
    });
    if (openChunksArtifactId === artifactId) setOpenChunksArtifactId(null);
    registerLoreChange();
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if (readOnlyReview || !text || Object.keys(loading).length > 0 || postingMessage) return;
    setInput("");
    setMentionQuery(null);
    setPostingMessage(true);

    let userMsg: Message;
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          content: text,
          artifactIds: selectedArtifactIds,
          sectionId: selectedSectionId || null,
        }),
      });
      if (!res.ok) {
        pushSystemMessage("Failed to save your message. Please retry.");
        setInput(text);
        return;
      }
      const saved = await res.json();
      setMessagesSinceLoreSync((prev) => {
        const next = prev + 1;
        if (next >= LORE_MESSAGE_THRESHOLD) {
          registerLoreChange();
          return 0;
        }
        return next;
      });

      userMsg = {
        ...saved,
        role: "user",
        artifact_ids: selectedArtifactIds,
        section_id: selectedSectionId || null,
        section_name: sections.find((s) => s.id === selectedSectionId)?.name ?? null,
        user_name: currentUser.name,
        user_avatar: currentUser.image,
      };
      setMessages(prev => [...prev, userMsg]);
    } finally {
      setPostingMessage(false);
    }

    const mentions = parseMentions(text);
    if (!mentions.length) {
      pushSystemMessage(
        "Your message is saved. To get an AI reply, add a helper such as @writer, @editor, or @researcher — or tap a chip above.",
      );
      return;
    }

    // Auto-synthesize when multiple agents are asked to weigh in.
    const orderedMentions = [...mentions];
    if (orderedMentions.length >= 2 && !orderedMentions.includes("director")) {
      orderedMentions.push("director");
    }

    const newLoading: Record<string, boolean> = {};
    orderedMentions.forEach(id => { newLoading[id] = true; });
    setLoading(newLoading);

    const historySnapshot = [...messages, userMsg].map(m => ({
      role: m.role,
      persona: m.persona,
      content: m.content,
      user_name: m.user_name,
    }));

    for (const personaId of orderedMentions) {
      try {
        const agentRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personaId,
            userMessage: text,
            roomId: room.id,
            history: historySnapshot,
            retrieval: {
              mode: retrievalMode,
              topK: retrievalTopK,
              threshold: retrievalThreshold,
              selectedArtifactIds,
            },
            sectionId: selectedSectionId || null,
          }),
        });
        const payload = await agentRes.json();
        if (!agentRes.ok) {
          throw new Error(payload.error ?? "Agent request failed");
        }
        const { text: agentText, citations, retrieval } = payload;
        const agentMsg: Message = {
          id: `${Date.now()}-${personaId}`,
          role: "agent",
          persona: personaId as PersonaId,
          content: agentText,
          citations: Array.isArray(citations) ? citations : [],
          retrieval_debug: retrieval ?? undefined,
          section_id: selectedSectionId || null,
          section_name: sections.find((s) => s.id === selectedSectionId)?.name ?? null,
          created_at: now(),
        };
        setMessages(prev => [...prev, agentMsg]);
        historySnapshot.push({ role: "agent", persona: personaId, content: agentText, user_name: undefined });
      } catch {
        const label = PERSONAS[personaId as PersonaId]?.name ?? personaId;
        pushSystemMessage(`${label} failed to respond. You can try again.`);
      }
      setLoading(prev => { const n = { ...prev }; delete n[personaId]; return n; });
    }
  }, [
    input,
    loading,
    postingMessage,
    messages,
    room.id,
    currentUser,
    selectedArtifactIds,
    selectedSectionId,
    sections,
    retrievalMode,
    retrievalTopK,
    retrievalThreshold,
    readOnlyReview,
  ]);

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
  const artifactNameMap = new Map(artifacts.map((a) => [a.id, a.name]));
  const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? null;

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
          <div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#e5e5e5" }}>{room.name}</div>
            {room.description && <div style={{ fontSize: "11px", color: "#555" }}>{room.description}</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => { setTourStepIdx(0); setTourOpen(true); }} style={{
            background: "none", border: "1px solid #2a2a2a", color: "#888",
            padding: "4px 10px", borderRadius: "6px", fontSize: "11px",
            fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
          }}>
            TOUR
          </button>
          {reviewScope?.read && (
            <span style={{ fontSize: "10px", color: readOnlyReview ? "#fbbf24" : "#34d399", fontFamily: "var(--font-mono)" }}>
              REVIEW {readOnlyReview ? "READ-ONLY" : "WRITE"}
            </span>
          )}
          <button onClick={() => setShowArtifacts((v) => !v)} style={{
            background: "none", border: "1px solid #2a2a2a", color: showArtifacts ? "#60a5fa" : "#666",
            padding: "4px 12px", borderRadius: "6px", fontSize: "11px",
            fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
          }}>
            {showArtifacts ? "HIDE FILES" : "FILES"}
          </button>
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

      {showArtifacts && (
        <div style={{
          padding: "12px 24px", borderBottom: "1px solid #1e1e1e", background: "#101010",
          display: "flex", flexDirection: "column", gap: "10px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", color: "#888", fontFamily: "var(--font-mono)" }}>
              LORE SOURCES ({artifacts.length})
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                ref={artifactInputRef}
                type="file"
                onChange={(e) => handleArtifactUpload(e.target.files?.[0])}
                style={{ display: "none" }}
              />
              <button
                onClick={() => artifactInputRef.current?.click()}
                disabled={uploadingArtifact || readOnlyReview}
                style={{
                  background: "#1d3461",
                  border: "1px solid #2d4f8a",
                  color: "#60a5fa",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  opacity: uploadingArtifact || readOnlyReview ? 0.6 : 1,
                }}
              >
                {uploadingArtifact ? "UPLOADING..." : "UPLOAD"}
              </button>
            </div>
          </div>
          {!ownerCanMaintainArtifacts && (
            <div style={{ color: "#777", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
              Chunk preview, re-index, and delete are owner-only tools.
            </div>
          )}
          {retrievalMode !== "selected_only" && (
            <div style={{ color: "#777", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
              Source selection applies only in selected sources mode.
            </div>
          )}
          {artifactError && <div style={{ color: "#f87171", fontSize: "12px" }}>{artifactError}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflow: "auto" }}>
            {artifacts.map((artifact) => (
              <div key={artifact.id} style={{
                display: "flex", flexDirection: "column", gap: "6px",
                background: "#151515", border: "1px solid #252525", borderRadius: "8px", padding: "8px 10px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <button
                    onClick={() => toggleArtifactSelection(artifact.id)}
                    disabled={retrievalMode !== "selected_only"}
                    title={retrievalMode === "selected_only" ? "Select source for lore retrieval" : "Switch retrieval mode to selected sources"}
                    style={{
                      background: "none",
                      border: "none",
                      color: selectedArtifactIds.includes(artifact.id) ? "#60a5fa" : "#bbb",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: retrievalMode === "selected_only" ? "pointer" : "not-allowed",
                      textAlign: "left",
                      opacity: retrievalMode === "selected_only" ? 1 : 0.65,
                    }}
                  >
                    <span>{selectedArtifactIds.includes(artifact.id) ? "☑" : "☐"}</span>
                    <span>{artifact.name}</span>
                    <span style={{ color: artifact.parse_status === "ready" ? "#34d399" : "#777", fontSize: "10px", fontFamily: "var(--font-mono)" }}>
                      {artifact.parse_status.toUpperCase()}
                    </span>
                  </button>
                  {ownerCanMaintainArtifacts ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        onClick={() => loadArtifactChunks(artifact.id)}
                        disabled={loadingChunksArtifactId === artifact.id}
                        title="Preview indexed chunks"
                        style={{
                          background: "none",
                          border: "1px solid #2a2a2a",
                          color: "#aaa",
                          borderRadius: "5px",
                          fontSize: "10px",
                          padding: "2px 6px",
                        }}
                      >
                        {loadingChunksArtifactId === artifact.id ? "LOADING..." : openChunksArtifactId === artifact.id ? "HIDE CHUNKS" : "CHUNKS"}
                      </button>
                      <button
                        onClick={() => reindexArtifact(artifact.id)}
                        disabled={reindexingArtifactId === artifact.id}
                        title="Re-run parsing and indexing"
                        style={{
                          background: "none",
                          border: "1px solid #2d4f8a",
                          color: "#60a5fa",
                          borderRadius: "5px",
                          fontSize: "10px",
                          padding: "2px 6px",
                        }}
                      >
                        {reindexingArtifactId === artifact.id ? "REINDEXING..." : "REINDEX"}
                      </button>
                      <button
                        onClick={() => deleteArtifact(artifact.id)}
                        title="Delete artifact and chunks"
                        style={{
                          background: "none",
                          border: "1px solid #3a1d1d",
                          color: "#f87171",
                          borderRadius: "5px",
                          fontSize: "10px",
                          padding: "2px 6px",
                        }}
                      >
                        DELETE
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: "10px", color: "#777", fontFamily: "var(--font-mono)" }}>
                      OWNER TOOLS
                    </span>
                  )}
                </div>
                {openChunksArtifactId === artifact.id && (
                  <div style={{ borderTop: "1px solid #222", paddingTop: "6px", display: "flex", flexDirection: "column", gap: "5px", maxHeight: "170px", overflow: "auto" }}>
                    {(artifactChunks[artifact.id] ?? []).map((chunk) => (
                      <div key={chunk.id} style={{ fontSize: "11px", color: "#999", lineHeight: 1.4 }}>
                        <span style={{ color: "#60a5fa", fontFamily: "var(--font-mono)", marginRight: "6px" }}>#{chunk.chunk_index}</span>
                        {chunk.content.slice(0, 280)}
                        {chunk.content.length > 280 ? "..." : ""}
                      </div>
                    ))}
                    {!(artifactChunks[artifact.id] ?? []).length && (
                      <div style={{ fontSize: "11px", color: "#666" }}>No chunks available.</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!artifacts.length && (
              <div style={{ color: "#666", fontSize: "12px" }}>No lore sources yet. Upload your world bible, character notes, timelines, or research.</div>
            )}
          </div>
          <div style={{
            marginTop: "6px",
            borderTop: "1px solid #1f1f1f",
            paddingTop: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
            <span style={{ fontSize: "11px", color: "#888", fontFamily: "var(--font-mono)" }}>
              NOTEBOOKLM BRIDGE
            </span>
            <div style={{ fontSize: "12px", color: "#9ca3af", lineHeight: 1.5 }}>
              Save your NotebookLM notebook link, then export a Lore Pack to upload as a source there.
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={notebookLmUrl}
                onChange={(e) => setNotebookLmUrl(e.target.value)}
                placeholder="https://notebooklm.google.com/..."
                disabled={readOnlyReview}
                style={{
                  minWidth: "240px",
                  flex: 1,
                  background: "#111",
                  color: "#bbb",
                  border: "1px solid #2a2a2a",
                  borderRadius: "6px",
                  padding: "6px 8px",
                  fontSize: "12px",
                }}
              />
              <button
                onClick={saveNotebookLmLink}
                disabled={readOnlyReview}
                style={{
                  background: "none",
                  border: "1px solid #2a2a2a",
                  color: "#aaa",
                  borderRadius: "6px",
                  fontSize: "11px",
                  padding: "6px 10px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                SAVE LINK
              </button>
              <button
                onClick={openNotebookLm}
                style={{
                  background: "none",
                  border: "1px solid #2d4f8a",
                  color: "#60a5fa",
                  borderRadius: "6px",
                  fontSize: "11px",
                  padding: "6px 10px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                OPEN NOTEBOOKLM
              </button>
              <button
                onClick={() => setShowNotebookGuide(true)}
                style={{
                  background: "none",
                  border: "1px solid #2a2a2a",
                  color: "#d1d5db",
                  borderRadius: "6px",
                  fontSize: "11px",
                  padding: "6px 10px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                GUIDED SYNC
              </button>
              <button
                onClick={exportLorePack}
                style={{
                  background: "#1d3461",
                  border: "1px solid #2d4f8a",
                  color: "#60a5fa",
                  borderRadius: "6px",
                  fontSize: "11px",
                  padding: "6px 10px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                EXPORT LORE PACK
              </button>
            </div>
            {notebookStatus && <div style={{ color: "#34d399", fontSize: "11px", fontFamily: "var(--font-mono)" }}>{notebookStatus}</div>}
          </div>
        </div>
      )}

      {!readOnlyReview && unsyncedLoreChanges > 0 && !showNotebookGuide && (
        <div style={{
          position: "fixed",
          left: "16px",
          bottom: "16px",
          zIndex: 131,
          width: "min(360px, calc(100vw - 24px))",
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: "12px",
          padding: "12px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}>
          <div style={{ color: "#60a5fa", fontSize: "11px", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
            NOTEBOOKLM SYNC REMINDER
          </div>
          <div style={{ color: "#e5e5e5", fontSize: "14px", marginBottom: "6px" }}>
            Your lore changed recently. Sync to keep NotebookLM up to date.
          </div>
          <div style={{ color: "#9ca3af", fontSize: "12px", lineHeight: 1.45 }}>
            Pending updates: {unsyncedLoreChanges}
            {lastLoreSyncAt ? ` · last sync ${new Date(lastLoreSyncAt).toLocaleString()}` : ""}
          </div>
          <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={() => setShowNotebookGuide(true)}
              style={{
                background: "#1d3461",
                border: "1px solid #2d4f8a",
                color: "#60a5fa",
                borderRadius: "6px",
                fontSize: "11px",
                padding: "6px 10px",
                fontFamily: "var(--font-mono)",
              }}
            >
              GUIDED SYNC
            </button>
            <button
              onClick={() => markLoreSynced("Marked as synced.")}
              style={{
                background: "none",
                border: "1px solid #2a2a2a",
                color: "#aaa",
                borderRadius: "6px",
                fontSize: "11px",
                padding: "6px 10px",
                fontFamily: "var(--font-mono)",
              }}
            >
              MARK SYNCED
            </button>
          </div>
        </div>
      )}

      {showNotebookGuide && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 135,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "14px",
        }}>
          <div style={{
            width: "min(680px, 100%)",
            maxHeight: "90vh",
            overflow: "auto",
            background: "#141414",
            border: "1px solid #2a2a2a",
            borderRadius: "12px",
            padding: "18px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ fontSize: "18px", color: "#e5e5e5" }}>Send Lore to NotebookLM</h3>
              <button
                onClick={() => setShowNotebookGuide(false)}
                style={{ background: "none", border: "none", color: "#888", fontSize: "18px", lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <p style={{ color: "#a3a3a3", fontSize: "13px", lineHeight: 1.5, marginBottom: "14px" }}>
              Follow these steps once and repeat anytime your world changes.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ background: "#111", border: "1px solid #252525", borderRadius: "10px", padding: "12px" }}>
                <div style={{ color: "#60a5fa", fontSize: "11px", fontFamily: "var(--font-mono)", marginBottom: "6px" }}>STEP 1</div>
                <div style={{ fontSize: "14px", color: "#e5e5e5", marginBottom: "6px" }}>Export your latest Lore Pack</div>
                <div style={{ fontSize: "12px", color: "#a3a3a3", marginBottom: "8px" }}>
                  This creates a single `.md` file with sections, lore sources, and recent story development.
                </div>
                <button
                  onClick={exportLorePack}
                  style={{
                    background: "#1d3461",
                    border: "1px solid #2d4f8a",
                    color: "#60a5fa",
                    borderRadius: "6px",
                    fontSize: "11px",
                    padding: "6px 10px",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  EXPORT LORE PACK
                </button>
              </div>

              <div style={{ background: "#111", border: "1px solid #252525", borderRadius: "10px", padding: "12px" }}>
                <div style={{ color: "#60a5fa", fontSize: "11px", fontFamily: "var(--font-mono)", marginBottom: "6px" }}>STEP 2</div>
                <div style={{ fontSize: "14px", color: "#e5e5e5", marginBottom: "6px" }}>Open your NotebookLM notebook</div>
                <div style={{ fontSize: "12px", color: "#a3a3a3", marginBottom: "8px" }}>
                  Create a notebook if needed, then upload the Lore Pack file as a source.
                </div>
                <button
                  onClick={openNotebookLm}
                  style={{
                    background: "none",
                    border: "1px solid #2d4f8a",
                    color: "#60a5fa",
                    borderRadius: "6px",
                    fontSize: "11px",
                    padding: "6px 10px",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  OPEN NOTEBOOKLM
                </button>
              </div>

              <div style={{ background: "#111", border: "1px solid #252525", borderRadius: "10px", padding: "12px" }}>
                <div style={{ color: "#60a5fa", fontSize: "11px", fontFamily: "var(--font-mono)", marginBottom: "6px" }}>STEP 3</div>
                <div style={{ fontSize: "14px", color: "#e5e5e5", marginBottom: "6px" }}>Set the notebook instruction</div>
                <div style={{ fontSize: "12px", color: "#a3a3a3", marginBottom: "8px" }}>
                  Paste this once into your NotebookLM instruction so lore stays consistent:
                </div>
                <div style={{
                  fontSize: "12px",
                  color: "#d1d5db",
                  background: "#0d0d0d",
                  border: "1px solid #222",
                  borderRadius: "8px",
                  padding: "8px",
                  lineHeight: 1.45,
                }}>
                  {notebookImportPrompt}
                </div>
                <div style={{ marginTop: "8px" }}>
                  <button
                    onClick={() => void copyNotebookPrompt()}
                    style={{
                      background: "none",
                      border: "1px solid #2a2a2a",
                      color: notebookGuideCopied ? "#34d399" : "#aaa",
                      borderRadius: "6px",
                      fontSize: "11px",
                      padding: "6px 10px",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {notebookGuideCopied ? "COPIED" : "COPY INSTRUCTION"}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "12px", fontSize: "12px", color: "#9ca3af", lineHeight: 1.5 }}>
              Tip: repeat this sync whenever you add major world changes, new chapters, or lore files.
            </div>
          </div>
        </div>
      )}

      {showTourPrompt && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 120,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: "min(520px, calc(100vw - 32px))",
            background: "#141414", border: "1px solid #2a2a2a", borderRadius: "12px",
            padding: "20px 18px",
          }}>
            <h3 style={{ fontSize: "18px", color: "#e5e5e5", marginBottom: "8px" }}>Quick walkthrough?</h3>
            <p style={{ fontSize: "14px", color: "#a3a3a3", lineHeight: 1.5 }}>
              Optional 60-second guide to show what each setting does in plain language.
            </p>
            <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
              <button onClick={startTour} style={{
                background: "#1d3461", border: "1px solid #2d4f8a", color: "#60a5fa",
                borderRadius: "8px", padding: "8px 12px", fontSize: "13px",
              }}>
                Start walkthrough
              </button>
              <button onClick={skipTour} style={{
                background: "none", border: "1px solid #2a2a2a", color: "#888",
                borderRadius: "8px", padding: "8px 12px", fontSize: "13px",
              }}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {tourOpen && (
        <div style={{
          position: "fixed", right: "16px", bottom: "16px", zIndex: 130,
          width: "min(420px, calc(100vw - 24px))",
          background: "#141414", border: "1px solid #2a2a2a", borderRadius: "12px",
          padding: "14px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ color: "#60a5fa", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
              STEP {tourStepIdx + 1} / {TOUR_STEPS.length}
            </span>
            <button onClick={() => setTourOpen(false)} style={{
              background: "none", border: "none", color: "#777", fontSize: "16px", lineHeight: 1,
            }}>×</button>
          </div>
          <div style={{ fontSize: "16px", color: "#e5e5e5", fontWeight: 600, marginBottom: "6px" }}>
            {TOUR_STEPS[tourStepIdx].title}
          </div>
          <div style={{ fontSize: "13px", color: "#a3a3a3", lineHeight: 1.5 }}>
            {TOUR_STEPS[tourStepIdx].body}
          </div>
          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <button
              onClick={() => setTourStepIdx((idx) => Math.max(0, idx - 1))}
              disabled={tourStepIdx === 0}
              style={{
                background: "none", border: "1px solid #2a2a2a", color: "#888",
                borderRadius: "8px", padding: "6px 10px", fontSize: "12px",
                opacity: tourStepIdx === 0 ? 0.5 : 1,
              }}
            >
              Back
            </button>
            {tourStepIdx < TOUR_STEPS.length - 1 ? (
              <button
                onClick={() => setTourStepIdx((idx) => Math.min(TOUR_STEPS.length - 1, idx + 1))}
                style={{
                  background: "#1d3461", border: "1px solid #2d4f8a", color: "#60a5fa",
                  borderRadius: "8px", padding: "6px 10px", fontSize: "12px",
                }}
              >
                Next
              </button>
            ) : (
              <button
                onClick={() => setTourOpen(false)}
                style={{
                  background: "#1d3461", border: "1px solid #2d4f8a", color: "#60a5fa",
                  borderRadius: "8px", padding: "6px 10px", fontSize: "12px",
                }}
              >
                Done
              </button>
            )}
            <button
              onClick={skipTour}
              style={{
                marginLeft: "auto",
                background: "none", border: "1px solid #2a2a2a", color: "#888",
                borderRadius: "8px", padding: "6px 10px", fontSize: "12px",
              }}
            >
              Skip tour
            </button>
          </div>
        </div>
      )}

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
          const generatedFiles = parseGeneratedFiles(msg.content);
          const displayContent = stripGeneratedFileBlocks(msg.content);

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
                  {displayContent && (
                    <div style={{ fontSize: "14px", color: "#e5e5e5", lineHeight: "1.55", whiteSpace: "pre-wrap" }}>
                      {renderContent(displayContent)}
                    </div>
                  )}
                  {msg.section_name && (
                    <div style={{ marginTop: "6px", fontSize: "10px", color: "#a78bfa", fontFamily: "var(--font-mono)" }}>
                      section: {msg.section_name}
                    </div>
                  )}
                  {!!generatedFiles.length && (
                    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {generatedFiles.map((file) => (
                        <div key={`${msg.id}-${file.filename}`} style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "10px", color: "#9ca3af", fontFamily: "var(--font-mono)" }}>
                            FILE: {file.filename}
                          </span>
                          <button
                            onClick={() => void downloadFile(file)}
                            style={{ fontSize: "10px", border: "1px solid #2a2a2a", background: "#111", color: "#ddd", borderRadius: "5px", padding: "2px 6px" }}
                          >
                            DOWNLOAD
                          </button>
                          {file.ext === "csv" && (
                            <button
                              onClick={() => void downloadFile(file, "xlsx")}
                              style={{ fontSize: "10px", border: "1px solid #2d4f8a", background: "#111", color: "#60a5fa", borderRadius: "5px", padding: "2px 6px" }}
                            >
                              XLSX
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!!msg.artifact_ids?.length && (
                    <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {msg.artifact_ids.map((artifactId) => (
                        <span
                          key={artifactId}
                          style={{
                            fontSize: "10px",
                            color: "#60a5fa",
                            border: "1px solid #2d4f8a",
                            borderRadius: "999px",
                            padding: "2px 6px",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {artifactNameMap.get(artifactId) ?? "Artifact"}
                        </span>
                      ))}
                    </div>
                  )}
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
                  {displayContent && (
                    <div style={{
                      background: "#111", border: "1px solid #222",
                      borderLeft: `3px solid ${persona.color}50`,
                      borderRadius: "0 8px 8px 0", padding: "10px 14px",
                      fontSize: "14px", color: "#d4d4d4", lineHeight: "1.65", whiteSpace: "pre-wrap",
                    }}>
                      {renderContent(displayContent)}
                    </div>
                  )}
                  {msg.section_name && (
                    <div style={{ marginTop: "6px", fontSize: "10px", color: "#a78bfa", fontFamily: "var(--font-mono)" }}>
                      section: {msg.section_name}
                    </div>
                  )}
                  {!!generatedFiles.length && (
                    <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {generatedFiles.map((file) => (
                        <div key={`${msg.id}-${file.filename}`} style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "10px", color: "#9ca3af", fontFamily: "var(--font-mono)" }}>
                            FILE: {file.filename}
                          </span>
                          <button
                            onClick={() => void downloadFile(file)}
                            style={{ fontSize: "10px", border: "1px solid #2a2a2a", background: "#111", color: "#ddd", borderRadius: "5px", padding: "2px 6px" }}
                          >
                            DOWNLOAD
                          </button>
                          {file.ext === "csv" && (
                            <button
                              onClick={() => void downloadFile(file, "xlsx")}
                              style={{ fontSize: "10px", border: "1px solid #2d4f8a", background: "#111", color: "#60a5fa", borderRadius: "5px", padding: "2px 6px" }}
                            >
                              XLSX
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!!msg.citations?.length && (
                    <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                      {msg.citations.map((citation) => (
                        <span
                          key={citation.chunkId}
                          style={{
                            fontSize: "10px",
                            color: "#aaa",
                            border: "1px solid #2a2a2a",
                            borderRadius: "999px",
                            padding: "2px 7px",
                            fontFamily: "var(--font-mono)",
                          }}
                          title={`score ${citation.score}`}
                        >
                          {citation.artifactName}#{citation.chunkIndex}
                        </span>
                      ))}
                    </div>
                  )}
                  {msg.retrieval_debug && (
                    <div style={{ marginTop: "6px", fontSize: "10px", color: "#777", fontFamily: "var(--font-mono)" }}>
                      retrieval {msg.retrieval_debug.mode} · chunks {msg.retrieval_debug.retrievedCount}/{msg.retrieval_debug.topK} · threshold {msg.retrieval_debug.threshold.toFixed(2)} · maxScore {msg.retrieval_debug.maxScore.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (msg.role === "system") {
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: "center" }}>
                <div style={{
                  maxWidth: "70%",
                  background: "#1a1208",
                  border: "1px solid #3a2a12",
                  color: "#fbbf24",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                }}>
                  {msg.content}
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
          <div style={{
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            fontSize: "11px",
            color: "#777",
            fontFamily: "var(--font-mono)",
          }}>
            <span>Story Section Tone</span>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={readOnlyReview}
              style={{ background: "#111", color: "#bbb", border: "1px solid #2a2a2a", borderRadius: "5px", padding: "2px 6px", fontSize: "11px" }}
            >
              <option value="">none</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
            <input
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="new section (ex: Chapter 1)"
              disabled={readOnlyReview}
              style={{ width: "120px", background: "#111", color: "#bbb", border: "1px solid #2a2a2a", borderRadius: "5px", padding: "2px 6px", fontSize: "11px" }}
            />
            <button
              onClick={() => void createSection()}
              disabled={readOnlyReview || !newSectionName.trim()}
              style={{ background: "none", border: "1px solid #2a2a2a", color: "#aaa", borderRadius: "5px", fontSize: "10px", padding: "2px 6px", fontFamily: "var(--font-mono)" }}
            >
              ADD SECTION
            </button>
            {selectedSection && (
              <>
                <input
                  value={sectionSpotifyUrl}
                  onChange={(e) => setSectionSpotifyUrl(e.target.value)}
                  placeholder="spotify track link for section mood"
                  disabled={readOnlyReview}
                  style={{ width: "180px", background: "#111", color: "#bbb", border: "1px solid #2a2a2a", borderRadius: "5px", padding: "2px 6px", fontSize: "11px" }}
                />
                <button
                  onClick={() => void applySpotifyMood()}
                  disabled={readOnlyReview || !sectionSpotifyUrl.trim() || sectionMoodBusy}
                  style={{ background: "none", border: "1px solid #2d4f8a", color: "#60a5fa", borderRadius: "5px", fontSize: "10px", padding: "2px 6px", fontFamily: "var(--font-mono)" }}
                >
                  {sectionMoodBusy ? "ANALYZING..." : "EXTRACT MOOD"}
                </button>
              </>
            )}
            {selectedSection?.mood_profile?.moodLabel && (
              <span style={{ color: "#9ca3af" }}>
                mood: {selectedSection.mood_profile.moodLabel}
              </span>
            )}
            {sectionError && <span style={{ color: "#f87171" }}>{sectionError}</span>}
          </div>
          <div style={{
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            fontSize: "11px",
            color: "#777",
            fontFamily: "var(--font-mono)",
          }}>
            <span>Retrieval</span>
            <button
              onClick={() => setShowRetrievalSettings((v) => !v)}
              style={{
                background: "none",
                border: "1px solid #2a2a2a",
                color: "#aaa",
                borderRadius: "5px",
                fontSize: "10px",
                padding: "2px 6px",
                fontFamily: "var(--font-mono)",
              }}
            >
              {showRetrievalSettings ? "HIDE SETTINGS" : "ADVANCED"}
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>Mode</span>
              <select
                value={retrievalMode}
                onChange={(e) => setRetrievalMode(e.target.value as RetrievalMode)}
                disabled={readOnlyReview}
                style={{ background: "#111", color: "#bbb", border: "1px solid #2a2a2a", borderRadius: "5px", padding: "2px 6px", fontSize: "11px" }}
              >
                <option value="room_wide">whole lore vault</option>
                <option value="selected_only">selected sources</option>
              </select>
            </label>
            {showRetrievalSettings && (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>TopK</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={retrievalTopK}
                    disabled={readOnlyReview}
                    onChange={(e) => setRetrievalTopK(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                    style={{ width: "54px", background: "#111", color: "#bbb", border: "1px solid #2a2a2a", borderRadius: "5px", padding: "2px 6px", fontSize: "11px" }}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>Threshold</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={readOnlyReview}
                    value={retrievalThreshold}
                    onChange={(e) => setRetrievalThreshold(Number(e.target.value))}
                  />
                  <span>{retrievalThreshold.toFixed(2)}</span>
                </label>
              </>
            )}
            {retrievalMode === "selected_only" && selectedArtifactIds.length === 0 && (
              <span style={{ color: "#fbbf24" }}>Select at least one lore source</span>
            )}
          </div>

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
              disabled={readOnlyReview}
              onChange={handleInput}
              onKeyDown={onKeyDown}
              placeholder="Describe what you want to write or build (type @ for a helper)..."
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
              disabled={readOnlyReview || !input.trim() || Object.keys(loading).length > 0 || postingMessage}
              style={{
                background: (postingMessage || Object.keys(loading).length > 0) ? "#1a1a1a" : "#1d3461",
                border: `1px solid ${(postingMessage || Object.keys(loading).length > 0) ? "#222" : "#2d4f8a"}`,
                color: (postingMessage || Object.keys(loading).length > 0) ? "#333" : "#60a5fa",
                width: "34px", height: "34px", borderRadius: "7px",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, fontSize: "16px", cursor: "pointer",
              }}
            >
              {(postingMessage || Object.keys(loading).length > 0) ? "·" : "↑"}
            </button>
          </div>
          <div style={{ marginTop: "6px", fontSize: "10px", color: "#333", fontFamily: "var(--font-mono)", display: "flex", justifyContent: "space-between" }}>
            <span>
              {readOnlyReview
                ? "Review mode is read-only. Token with write scope required for chat."
                : postingMessage
                  ? "Sending your message…"
                  : "↵ send · shift+↵ newline · add @writer (or a chip) for an AI reply"}
            </span>
            <span>{messages.length} messages in session</span>
          </div>
        </div>
      </div>
    </div>
  );
}
