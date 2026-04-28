# Step 9 — Room Types Migration

## 9.1 Run the SQL migration

In **Supabase → SQL Editor**, run:

```sql
-- Add room_type column to rooms table
alter table rooms
  add column if not exists room_type text
  not null default 'writers'
  check (room_type in ('writers', 'jobhunt', 'career', 'publishing'));
```

Existing rooms will default to `writers` — no data loss.

## Room types

| Type | Label | Agents |
|---|---|---|
| `writers` | Writers Room | researcher, writer, editor, critic, director |
| `jobhunt` | Job Hunt | researcher, strategist, writer, coach, networker |
| `career` | Career | navigator, advocate, planner, writer, scheduler |
| `publishing` | Publishing | scout, editor, pitcher, marketer, advocate |

## Editing prompts via GitHub

All agent system prompts live in `lib/personas.ts`. To edit a prompt:

1. Open `lib/personas.ts` in the GitHub web editor
2. Find the agent by name (e.g. `pitcher:`)
3. Edit the `system:` string
4. Commit — Vercel deploys automatically in ~2 minutes

No local setup needed. Git history gives you version control on every prompt change.
