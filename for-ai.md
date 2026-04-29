# for-ai.md — Writers Room
*Context document for AI assistants continuing development on this project.*
*Last updated: April 2026 — 93 commits, clean build.*

---

## What this is

Writers Room is a collaborative AI workspace — a multi-agent chat room where users call specialized agents by @mention. Built for four use cases: creative writing, job hunting, career development, and publishing. Live at [writersroom.fredericlabadie.com](https://writersroom.fredericlabadie.com).

**Repo:** `fredericlabadie/Writers-room`
**Stack:** Next.js 14 (App Router) · TypeScript · Supabase · Anthropic API (`claude-sonnet-4-5`) · NextAuth v5 · Vercel

---

## Getting oriented fast

The entire chat UI lives in one file: `components/WritersRoom.tsx` (~3700 lines). Everything else feeds into it.

**The three files you'll touch most:**
- `lib/personas.ts` — all agent definitions, system prompts, room type config
- `components/WritersRoom.tsx` — full chat UI, all state, all interactions
- `app/api/chat/route.ts` — main agent call endpoint

**Agent call flow:**
```
user @mentions → parse handles → POST /api/chat per agent
  → build composed prompt (persona + voice + context + folder lore + RAG + directions)
  → call Anthropic claude-sonnet-4-5
  → stream to client → persist to Supabase → broadcast via Realtime
```

---

## Room types and agents

Each room has its own agent set. Don't assume `researcher` or `writer` are in every room.

| Room | agentIds |
|---|---|
| `writers` | researcher · writer · editor · critic · director |
| `jobhunt` | intel · strategist · writer · coach · networker |
| `career` | analyst · navigator · advocate · planner · drafter · scheduler |
| `publishing` | reader · scout · editor · pitcher · marketer · advocate |

**Key agents:**
- `@director` — only agent that synthesizes; output generates a "Next move" clickable chain; also fires auto-interventions and return briefs
- `@scheduler` — only in jobhunt/career; surfaces calendar events, creates them via Google Calendar or .ics
- `@intel` — job hunt researcher (company/role/comp data)
- `@analyst` — career researcher (org/comp benchmarks)
- `@reader` — publishing researcher (audience/genre/comp titles)
- `@drafter` — career professional writer (promotion cases, emails, assessments — not creative prose)

**Multi-agent syntax:**
```
@researcher @writer          → parallel (both respond independently)
@researcher → @writer        → chain (writer sees researcher output and reacts)
```

---

## Screens and views

`WritersRoom.tsx` has two layers of navigation:

**`screen`** state — top-level route within the room:
- `"chat"` — main chat interface
- `"roles"` — Configure Roles (agent voice, context, inspirations)

**`viewMode`** state — tab switcher within the chat screen:
- `"chat"` — default message feed
- `"studio"` — Director Studio: latest Director synthesis as hero, per-agent contribution columns
- `"dashboard"` — Room Dashboard: room stats, member list, room settings

**Onboarding overlay** (`onboardStep`) — shown instead of the chat screen on first run:
- `"cast"` — cast picker: user selects which agents they want active
- `"stage"` — stage form: about, reader/references, tone
- `"generating"` — Director generates personalized opening (calls `/api/rooms/[roomId]/onboard`)
- `"done"` / `null` — onboarding dismissed, normal chat

---

## Director systems

Three Director-driven systems run on top of the main chat:

### 1. Auto-interventions
After every user message (throttled to max 1 per 5 turns), the client checks the last few messages for:
- `"hedge_word"` — vague/wishy-washy language in recent agent output
- `"thread_drift"` — conversation drifting from the original goal
- `"pattern_working"` — positive pattern worth reinforcing

If triggered → POST `/api/director/intervene` → Director returns a short note + optional `suggestedPin`.
Rendered as `InterventionNote` anchored below the trigger message. User can pin it, save as a direction, or dismiss.

### 2. Async return brief
When loading a room after 2+ hours away:
1. Compares `localStorage` last-seen timestamp to message timestamps
2. Finds unseen messages, builds a timeline of events (`"@writer produced a draft"`, etc.)
3. POST `/api/director/brief` → Director narrates what happened
4. Shows `ReturnBrief` overlay with narrative + event list + "catch me up" scroll button

### 3. Director chain (existing)
Director synthesis includes a "Next move: @agent1 → @agent2" line. This becomes a clickable chain button in `DirectorMessage`. One tap fires agents in sequence.

---

## Realtime presence

Supabase Realtime presence channel (`room-presence-${room.id}`):
- Each user broadcasts their `status`: `"reading"` | `"typing"` | `"idle"`
- Typing is detected when the input has content; clears 3s after last keystroke
- Rendered as `PresenceChips` in the header — avatar chips with color-coded status dots (green glow when typing)
- Write-lock banner shown if another user is currently typing

---

## Folder system

Folders are project containers. Rooms are chapters/sessions inside them. **Folder lore cascades into every agent call.**

**Schema:**
```
folders         (id, name, description, owner_id, genre, reader, tone, about, created_at)
folder_members  (folder_id, user_id, role: owner|member, joined_at)
folder_pins     (id, folder_id, text, created_by, created_at)
rooms.folder_id (uuid FK → folders.id, ON DELETE SET NULL)
```

**Lore injection:** Before building the system prompt, `/api/chat` fetches the room's `folder_id`, then fetches folder lore + pins. Appended as a `FOLDER LORE` block. Rooms without a folder get no injection.

**Key patterns:**
- Rooms can exist without a folder (`folder_id = null`)
- POST `/api/rooms` accepts optional `folder_id`
- Deleting a folder sets rooms' `folder_id` to null (ON DELETE SET NULL) — rooms are never deleted
- Folder pins are project-scoped directions that don't expire per session

---

## Supabase schema

```sql
rooms          (id, name, description, owner_id, is_private, room_type, invite_code,
                notebooklm_url, active_tone, notes TEXT, folder_id, created_at)
messages       (id, room_id, role, persona, content, citations, artifact_ids,
                section_id, user_id, created_at)
room_members   (room_id, user_id, role: owner|member, joined_at)
profiles       (id, name, avatar_url, created_at)
artifacts      (id, room_id, name, mime_type, storage_path, kind, parse_status)
artifact_chunks(id, artifact_id, chunk_index, text, embedding vector(1536))
review_links   (id, room_id, token, created_by, expires_at)
rate_limits    (user_id, call_count, window_start)
folders        (id, name, description, owner_id, genre, reader, tone, about, created_at)
folder_members (folder_id, user_id, role: owner|member, joined_at)
folder_pins    (id, folder_id, text, created_by, created_at)
```

SQL migrations in `docs/` — run in order when setting up a fresh Supabase project.

**Key patterns:**
- Client never touches DB directly — all queries via `createSupabaseServiceClient()` (service role key)
- pgvector cosine similarity for RAG (`artifact_chunks.embedding vector(1536)`)
- Realtime subscriptions filter by `room_id`
- `notes` is TEXT on `rooms` — single shared doc, not a separate table

---

## Auth

NextAuth v5. Two providers: Google and GitHub.

- Google users get `googleAccessToken` on the session — used for Google Calendar and Google Drive export
- GitHub users get standard session only
- `hasCalendarAccess` in `WritersRoom.tsx` gates Google-specific features
- Auth config in `lib/auth.ts`

---

## API routes

```
POST /api/chat                              Agent call (main endpoint)
GET  /api/rooms                             List user's rooms
POST /api/rooms                             Create room (must pass room_type; optional folder_id)
GET  /api/rooms/[roomId]                    Room details (includes notes, folder_id)
PATCH /api/rooms/[roomId]                   Update room (name, description, is_private,
                                              notebooklm_url, active_tone, notes)
DELETE /api/rooms/[roomId]                  Owner only
POST /api/rooms/[roomId]/onboard            Generate Director opening + agent intros (first-run)
GET  /api/rooms/[roomId]/export             .md file download
POST /api/rooms/[roomId]/export             Google Drive (returns {driveUrl}) or .md fallback
POST /api/rooms/[roomId]/messages           Persist a message
DELETE /api/rooms/[roomId]/messages/[id]    Delete a message
GET  /api/rooms/[roomId]/artifacts          List artifacts
POST /api/artifacts/upload                  Upload + chunk + embed a file
POST /api/rooms/[roomId]/review-links       Generate 72h read-only token
GET  /api/r/[token]                         Validate review token, return room snapshot
GET  /api/search?q=...&roomId=...           Search messages (ilike), grouped by room
POST /api/director/brief                    Director "while you were away" narrative
POST /api/director/intervene                Director auto-intervention (hedge/drift/pattern)
GET  /api/folders                           List folders (owned + member)
POST /api/folders                           Create folder
GET  /api/folders/[folderId]               Folder detail + pins + rooms
PATCH /api/folders/[folderId]              Update lore fields
DELETE /api/folders/[folderId]             Owner only; rooms un-assigned not deleted
GET  /api/folders/[folderId]/pins          List pins
POST /api/folders/[folderId]/pins          Add pin
DELETE /api/folders/[folderId]/pins/[id]   Remove pin
POST /api/calendar/create-event            Create Google Calendar event
POST /api/sections                          Create room section with Spotify mood
GET  /api/spotify/audio-features           Proxy Spotify audio features
```

---

## Key patterns in WritersRoom.tsx

**Theme tokens** — all in `const T`. Never hardcode colors:
```ts
T.bg / T.bg2 / T.surf / T.surf2   // backgrounds, surfaces
T.bdr / T.bdr2 / T.faint          // borders
T.text / T.body / T.sub / T.meta  // text hierarchy
T.mono / T.sans / T.serif / T.italic  // font families
```

**Agent rendering** — `AgentMessage` branches by persona into five voice-distinct treatments:
- `writer/drafter` — Source Serif Pro italic, 17px, manuscript margin mark
- `researcher/intel/analyst/reader` — IBM Plex Mono block with source footer
- `editor` — IBM Plex Sans, REVISION label, gold left border
- `critic` — dashed border, indented 56px, CHALLENGE label
- `director` — full-bleed with DM Serif Display body, chain button
- all others — clean left-ruled block

All messages support **minimize** (▾/▸ on hover) and **delete with confirm** (× → inline "delete? [no] [yes]").
Collapse state is `collapsedMsgs: Set<string>` — local only, not persisted.

**Notes panel** — `notesOpen` toggle shows 30% right panel. PATCH debounced 2s after keystroke.

**Directions panel** — horizontal chip strip pinned between header and messages. Injected into every agent call.

**Rate limiting** — 30 calls/hour per user, server-side in `/api/chat`.

**Response length toggle** — ⊟/⊡/⊞ → `max_tokens` multiplier 0.4× / 1.0× / 1.8×.

---

## Common gotchas

- **`room_type` must be set on insert** — no reliable DB default. Always pass it in POST `/api/rooms`.
- **`ALL_AGENTS` closing brace** — when adding agents, the `};` closing the object has been misplaced before. Verify the brace is after the last agent, before the room type config section.
- **Intervention throttle** — max 1 auto-intervention per 5 user turns (`lastInterventionTurn` ref). Don't call `/api/director/intervene` from new code paths without respecting this.
- **Return brief** — only fires if `localStorage` has a `wr-last-seen-${room.id}` key AND the gap is >2 hours AND there are unseen messages. All three conditions required.
- **Google token** — `(session as any).googleAccessToken` — untyped. Always check for existence before using.
- **Chain vs parallel** — parallel calls share base history. Chained calls inject only the immediately preceding agent's response (intentional — avoids token bloat).
- **pgvector dimension** — `vector(1536)`. New chunk insertions must match exactly.
- **Onboarding guard** — `/api/rooms/[roomId]/onboard` returns 409 if the room already has messages. This is intentional.

---

## What was recently built (as of April 2026)

**This session (with fredericlabadie):**
- Room notes panel + dual export (Google Drive / .md)
- Message delete confirmation + minimize/expand
- Design pass: login, rooms dashboard, WritersRoom header/empty state
- Room-specific researcher agents (`@intel`, `@analyst`, `@reader`) + `@drafter` for Career
- Bug fix: `room_type` was never saved on room creation

**Previous session (other Claude instance):**
- **Onboarding flow** — 4-step first-run: cast picker → stage form → `/api/rooms/[roomId]/onboard` → Director-generated opening with per-agent intros and first question
- **Realtime presence** — Supabase presence channel, avatar chips in header, typing indicators (green glow), write-lock banner
- **Director auto-interventions** — server-side pattern detection (hedge words, thread drift, positive patterns), `InterventionNote` component, pin/direction/dismiss actions
- **Async return brief** — 2hr threshold, timeline events, Director narrates via `/api/director/brief`, `ReturnBrief` overlay with catch-up scroll
- **Director Studio view** (`viewMode: "studio"`) — Director synthesis as hero, per-agent contribution columns with DRAFT/INTEL/REVISION/OBJECTION labels
- **Room Dashboard view** (`viewMode: "dashboard"`) — room stats and settings tab
- **Settings page** — accessible from Configure Roles
- **Configure Roles v2** — weighted inspirations canvas, live prompt preview, export per-agent or all-agents
- **Review links** + public `/app/r/[token]` read-only page
- **⌘K message search** — debounced, grouped by room, keyboard nav
- **Folder system** — project containers, lore injection into every agent call, folder pins, sidebar tree

---

## Working with this codebase

**To add a new agent:**
1. Add to `AGENT_COLORS` and `ACCENT` in `lib/personas.ts`
2. Add definition to `ALL_AGENTS` (inside the object, before `};`)
3. Add handle to room's `agentIds` in `ROOM_TYPE_CONFIG`

**To add a new Director system:**
Follow the pattern in `/api/director/intervene` — auth, verify membership, build a tight system prompt, return structured JSON.

**To add a new screen/view:**
Add a value to the `screen` or `viewMode` union type, add a render branch in the JSX, wire a button in the header.

**To update a system prompt:**
Edit `system:` in the agent definition in `lib/personas.ts`. Voice/context from Configure Roles is appended at call time.

**Deploy:** Push to main → Vercel auto-deploys (~2 min).
