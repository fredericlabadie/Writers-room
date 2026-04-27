# Writers Room

A collaborative AI writing space with multiple specialized agents. Mention agents by name to bring them into the conversation — they only consume tokens when called.

**Live:** [writersroom.fredericlabadie.com](https://writersroom.fredericlabadie.com)

## Agents

| Handle | Role |
|---|---|
| `@researcher` | Facts, context, source suggestions |
| `@writer` | Drafts, prose, narrative development |
| `@editor` | Revisions, structure, clarity |
| `@critic` | Challenges assumptions, stress-tests ideas |
| `@director` | Synthesizes, keeps the room on track |

## Features

- **Google + GitHub OAuth** — one-click login, no passwords
- **Private & shared rooms** — create your own space or invite collaborators
- **Living chat log** — every agent call includes the full room history as context
- **Token-efficient** — agents only fire when `@`-mentioned
- **Persistent history** — conversations saved to Supabase Postgres

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
