# Writers Room

A collaborative AI writing space with multiple specialized agents. Mention agents by name to bring them into the conversation — they only consume tokens when called.

**Live:** [writersroom.fredericlabadie.com](https://writersroom.fredericlabadie.com)  
**Source:** [github.com/fredericlabadie/writers-room](https://github.com/fredericlabadie/writers-room)

## Showcasing (portfolio)

Worth doing if you use this as a sample on your site or in interviews:

- **Pin** the [writers-room](https://github.com/fredericlabadie/writers-room) repo and add **topics** (e.g. `nextjs`, `typescript`, `supabase`, `ai`, `rag`).
- Add a **screenshot or short screen recording** (login → room → @mention → reply) in the GitHub repo description, a PR description, or your personal site—avoid secrets and real user data in the capture.
- In interviews, lead with one line: *multi-agent chat with RAG over uploads, auth, and production deploy*—then deep-link to a folder (e.g. `app/api/chat/`, `lib/artifacts/`) if they ask.
- **Optional:** a tiny **case study** (problem → what you built → stack) on your site or in the special profile repo README; link **live** + **source** side by side.

### Link from your main GitHub repo (e.g. profile `username/username`)

Paste something like this into that repo’s `README.md` (or your personal site) and adjust the copy to your voice:

```markdown
### Writers Room — story & worldbuilding studio

- **Live:** <https://writersroom.fredericlabadie.com>
- **Code:** <https://github.com/fredericlabadie/writers-room>

Next.js, Supabase, multi-agent @mentions, artifact RAG, NotebookLM export bridge, Vercel.
```

## Agents

| Handle | Role |
|---|---|
| `@researcher` | Facts, context, source suggestions |
| `@writer` | Drafts, prose, narrative development |
| `@editor` | Revisions, structure, clarity |
| `@critic` | Challenges assumptions, stress-tests ideas |
| `@director` | Story guide: synthesizes and keeps worldbuilding on track |

## Features

- **Google + GitHub OAuth** — one-click login, no passwords
- **Private & shared rooms** — create your own space or invite collaborators
- **Living chat log** — every agent call includes the full room history as context
- **Token-efficient** — agents only fire when `@`-mentioned
- **Persistent history** — conversations saved to Supabase Postgres
- **Role-tuned generation** — each agent uses different temperature and token budgets
- **Auto-guide synthesis** — when 2+ agents are mentioned, `@director` closes with a decision and next move
- **NotebookLM bridge** — save your NotebookLM URL and export a room Lore Pack for long-term lore storage
- **Artifacts + RAG** — upload book bibles/docs/images and ground replies with citations
- **Section tone controls** — extract mood from Spotify tracks and apply tone by section
- **AI review mode** — share signed, scoped review links with Claude/other AIs

**Related (separate codebase):** [book-playlist-tool](https://github.com/fredericlabadie/book-playlist-tool) — book ↔ playlist suggestions. Reuse the same `ANTHROPIC_API_KEY` and `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` in its `.env.local`.

## Stack

- **Next.js 14** (App Router + TypeScript)
- **NextAuth v5** (Google + GitHub OAuth)
- **Supabase** (Postgres database + auth helpers)
- **Anthropic Claude** (claude-sonnet-4-5 via server-side proxy)
- **Vercel** (hosting + edge functions)

## Setup

See the [`/docs`](./docs) folder:

1. [Repo Setup](./docs/01-repo-setup.md)
2. [Supabase Setup](./docs/02-supabase-setup.md)
3. [OAuth Setup](./docs/03-oauth-setup.md)
4. [Vercel Deploy](./docs/04-vercel-deploy.md)
5. [Scaleway DNS](./docs/05-scaleway-dns.md)
6. [Artifacts + RAG + Review Mode](./docs/06-artifacts-rag-review.md)

Or open [`docs/index.html`](./docs/index.html) for a visual overview.

## Local Development

```bash
cp .env.example .env.local
# Fill in all values in .env.local

npm install
npm run dev
# → http://localhost:3000
```

## Project Structure

```
writers-room/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # OAuth endpoints
│   │   ├── chat/                 # Anthropic proxy (auth-gated)
│   │   ├── messages/             # Load / save messages
│   │   └── rooms/                # CRUD + invite join
│   ├── login/                    # OAuth login page
│   └── rooms/
│       ├── page.tsx              # Room dashboard
│       └── [roomId]/page.tsx     # The writers room itself
├── components/
│   └── WritersRoom.tsx           # Main chat UI
├── lib/
│   ├── auth.ts                   # NextAuth config
│   ├── personas.ts               # Agent definitions
│   └── supabase.ts               # DB clients
├── types/index.ts
└── middleware.ts                 # Route protection
```
