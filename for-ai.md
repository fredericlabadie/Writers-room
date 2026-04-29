# for-ai.md — Writers Room
*Context document for AI assistants continuing development on this project.*

---

## What this is

Writers Room is a collaborative AI workspace — a multi-agent chat room where users call specialized agents by @mention. Built for four use cases: creative writing, job hunting, career development, and publishing. Live at [writersroom.fredericlabadie.com](https://writersroom.fredericlabadie.com).

**Repo:** `fredericlabadie/Writers-room`
**Stack:** Next.js 14 (App Router) · TypeScript · Supabase · Anthropic API · NextAuth v5 · Vercel

---

## Getting oriented fast

The entire chat UI lives in one file: `components/WritersRoom.tsx` (~2400 lines). Everything else feeds into it.

**The three files you'll touch most:**
- `lib/personas.ts` — all agent definitions, system prompts, room type config
- `components/WritersRoom.tsx` — full chat UI, all state, all interactions
- `app/api/rooms/[roomId]/route.ts` — GET/PATCH/DELETE for a room

**Agent call flow:**
```
user @mentions → parse handles → POST /api/chat per agent
  → build composed prompt (persona + voice + context + RAG + directions)
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
- `@director` — only agent that synthesizes; its output generates a "Next move" clickable chain
- `@scheduler` — only in jobhunt/career; surfaces calendar events, creates them via Google Calendar or .ics
- `@intel` — job hunt researcher (company/role/comp data)
- `@analyst` — career researcher (org/comp benchmarks)
- `@reader` — publishing researcher (audience/genre/comp titles)
- `@drafter` — career professional writer (not creative — promotion cases, emails, assessments)

**Multi-agent syntax:**
```
@researcher @writer          → parallel (both respond independently)
@researcher → @writer        → chain (writer sees researcher output and reacts)
```

---

## Supabase schema

```sql
rooms          (id, name, description, owner_id, is_private, room_type, invite_code,
                notebooklm_url, active_tone, notes TEXT, created_at)
messages       (id, room_id, role, persona, content, citations, artifact_ids,
                section_id, user_id, created_at)
room_members   (room_id, user_id, role: owner|member, joined_at)
profiles       (id, name, avatar_url, created_at)
artifacts      (id, room_id, name, mime_type, storage_path, kind, parse_status)
artifact_chunks(id, artifact_id, chunk_index, text, embedding vector(1536))
review_links   (id, room_id, token, created_by, expires_at)
rate_limits    (user_id, call_count, window_start)
```

**Key patterns:**
- Client never touches DB directly — all queries go through server routes with `createSupabaseServiceClient()` (service role key)
- pgvector cosine similarity for RAG retrieval on `artifact_chunks`
- Realtime subscriptions filter by `room_id`
- `notes` is a TEXT column on `rooms` (not a separate table) — single shared doc per room

---

## Auth

NextAuth v5. Two providers: Google and GitHub.

- Google users get `googleAccessToken` on the session — used for Google Calendar and Google Drive export
- GitHub users get standard session only
- `hasCalendarAccess` in WritersRoom.tsx gates Google-specific features (calendar creation, Drive export)
- Auth config in `lib/auth.ts`

---

## API routes

```
POST /api/chat                         Agent call (main endpoint)
GET  /api/rooms                        List user's rooms
POST /api/rooms                        Create room (must include room_type)
GET  /api/rooms/[roomId]               Room details (includes notes)
PATCH /api/rooms/[roomId]              Update room (allowed: name, description, is_private,
                                         notebooklm_url, active_tone, notes)
DELETE /api/rooms/[roomId]             Owner only
GET  /api/rooms/[roomId]/export        Returns .md download
POST /api/rooms/[roomId]/export        Google Drive (returns {driveUrl}) or .md fallback
POST /api/rooms/[roomId]/messages      Persist a message
DELETE /api/rooms/[roomId]/messages/[id]  Delete a message
GET  /api/rooms/[roomId]/artifacts     List artifacts
POST /api/artifacts/upload             Upload + chunk + embed a file
POST /api/rooms/[roomId]/review-links  Generate 72h read-only token
GET  /api/review/[token]               Validate review token
POST /api/calendar/create-event        Create Google Calendar event
POST /api/sections                     Create a room section with Spotify mood
GET  /api/spotify/audio-features       Proxy Spotify audio features
```

---

## Key patterns in WritersRoom.tsx

**Theme tokens** — all colors/fonts live in `const T` at the top. Never hardcode colors elsewhere in the component. The full token set (as of Claude Design v2):

```ts
T.bg    = "#0a0a0c"   // app background (slight blue tint vs old #0a0a0a)
T.bg2   = "#0e0e11"   // inset / placeholder (NEW)
T.surf  = "#131318"   // card / panel surface
T.surf2 = "#1a1a20"   // raised surface
T.bdr   = "#23232a"   // default border
T.bdr2  = "#2e2e36"   // stronger border
T.text  = "#e5e5ea"   // primary text
T.body  = "#b8b8c0"   // body text inside messages (NEW)
T.sub   = "#8a8a92"   // subdued text
T.meta  = "#5a5a62"   // meta / labels (darker than before)
T.faint = "#3a3a42"   // decorative dividers (NEW)
T.mono  = IBM Plex Mono
T.sans  = IBM Plex Sans
T.serif = DM Serif Display (NEW — Director synthesis, room names, display moments)
T.italic = Source Serif Pro italic (NEW — Writer manuscript voice)
```

**Agent rendering** — five voice-distinct component types, all inside `AgentMessage` (which branches by `msg.persona`):
- `UserMessage` — right-aligned, grey bubble
- `AgentMessage (writer)` — `Source Serif Pro italic`, 17px, 1.9 leading, left-ruled with manuscript margin mark
- `AgentMessage (researcher/intel/analyst/reader)` — `IBM Plex Mono` block with source footer
- `AgentMessage (editor)` — `IBM Plex Sans`, REVISION label, left-ruled gold border
- `AgentMessage (critic)` — dashed border, indented 56px, CHALLENGE/dissent label
- `AgentMessage (default)` — clean left-ruled block for all other agents
- `DirectorMessage` — full-bleed synthesis block with `DM Serif Display` body, chain button

All three support **minimize** (▾/▸ hover button) and **delete with confirm** (× → "delete? [no] [yes]" inline).

**Collapse state** — `collapsedMsgs: Set<string>` in component state. Not persisted to DB, local only.

**Directions panel** — horizontal strip pinned between header and chat when directions exist. Shows inline chips with Director `◎` icon, italic text excerpt, and "injected into every call" label. Previously a vertical list — now a single-row overflow-hidden strip matching the design artboard.

**Export** — `handleExport()` checks `hasCalendarAccess`; Google users → POST (Drive), others → GET (.md download).

**Rate limiting** — 30 calls/hour per user, enforced in `/api/chat`.

**Response length toggle** — ⊟/⊡/⊞ controls `max_tokens` multiplier: 0.4× / 1.0× / 1.8×.

---

## Common gotchas

- **room_type must be explicitly set on insert** — there's no reliable DB default. Always pass it in POST /api/rooms.
- **Agents outside their room** — if you add a new agent, add it to `ALL_AGENTS` in personas.ts AND to the relevant room's `agentIds`. Verify the object brace placement — the `};` closing `ALL_AGENTS` has been accidentally misplaced before.
- **Google token** — `(session as any).googleAccessToken` — not typed in the session. Handle gracefully.
- **Chain vs parallel** — parallel calls share base history. Chained calls inject only the immediately preceding agent's response to avoid token bloat.
- **pgvector** — the `embedding` column uses `vector(1536)`. Any new chunk insertions must use the same dimension.

---

## What was recently built (as of April 2026)

- Room notes panel (`notes` column on rooms, collapsible UI, auto-save)
- Dual export (GET=.md, POST=Google Drive)
- Message delete confirmation + minimize/expand on all message types
- Room-specific researcher agents: `@intel` (job hunt), `@analyst` (career), `@reader` (publishing)
- `@drafter` agent for career room (replaces generic `@writer`)
- Bug fix: `room_type` was never saved on room creation (was always defaulting to `writers`)
- **Claude Design v2 pass** (latest):
  - New color palette — blue-tinted darks, updated token names (`bg2`, `body`, `faint`)
  - Agent colors: critic `#ff3d3d` → `#ff5a5a`, director `#c030ff` → `#c89cff`
  - Two new font families: `DM Serif Display` (Director synthesis, display moments) and `Source Serif Pro italic` (Writer manuscript voice)
  - `AgentMessage` now branches per persona into five voice-distinct treatments (manuscript / research note / redline / dissent / default)
  - `DirectorMessage` body uses `DM Serif Display` 20px
  - `DirectionsPanel` redesigned: vertical list → horizontal inline chip strip
  - Login page redesigned: single-column fade-up → two-column grid with serif headline, ambient grid background, Director preview card, feature list
  - Rooms page: serif font on room card names, updated token values throughout

---

## Working with this codebase

**To add a new agent:**
1. Add color to `AGENT_COLORS` and `ACCENT` objects in personas.ts
2. Add the agent definition to `ALL_AGENTS` (inside the object, before `};`)
3. Add the agent handle to the relevant room's `agentIds` in `ROOM_TYPE_CONFIG`
4. The agent is automatically available for @mention in those rooms

**To add a new API route:**
Follow the pattern in `app/api/rooms/[roomId]/route.ts` — always auth first (`const session = await auth()`), then verify membership via `room_members`, then query.

**To update a system prompt:**
Edit the `system:` field in the relevant agent definition in `lib/personas.ts`. The voice/context settings in Configure Roles are appended on top of this base prompt at call time.

**Deploy:**
Push to main → Vercel auto-deploys. Build time ~2 minutes.
