# Step 8 — Rate Limiting & Realtime Sync

## 8.1 Run the SQL migration

In **Supabase → SQL Editor**, run:

```sql
-- Rate limiting: append-only log of agent API calls per user
create table if not exists rate_limits (
  id         uuid default gen_random_uuid() primary key,
  user_id    text not null references profiles(id) on delete cascade,
  called_at  timestamptz default now()
);

-- Index for fast per-user hourly window queries
create index if not exists rate_limits_lookup on rate_limits (user_id, called_at);

-- Auto-clean rows older than 48 hours to keep the table small
-- Run this as a scheduled job in Supabase (Database → Scheduled Jobs)
-- or add to a cron: DELETE FROM rate_limits WHERE called_at < now() - interval '48 hours';
```

**Limit:** 30 agent API calls per user per hour. Adjust `LIMIT_PER_HOUR` in `lib/rateLimit.ts` if needed.

---

## 8.2 Enable Realtime on the messages table

In **Supabase → SQL Editor**, run:

```sql
-- Enable Realtime replication for the messages table
alter publication supabase_realtime add table messages;
```

**Or** via the Supabase dashboard:
1. Go to **Database → Replication**
2. Find the `messages` table
3. Toggle **Insert** events on

This is required for the live sync to work. Without it, messages from other users in a shared room won't appear until page refresh.

---

## How it works

### Rate limiting
- Every authenticated call to `POST /api/chat` checks the `rate_limits` table
- If the user has made ≥ 30 calls in the current hour window, returns `429` with `Retry-After` header
- The UI shows an inline error banner above the input with the reset time
- Review token users (read-only links) are exempt from rate limiting
- On DB error, the check fails open (user is not blocked)

### Realtime sync
- On room mount, a Supabase channel subscribes to `INSERT` events on `messages` filtered by `room_id`
- A `seenIds` Set tracks all message IDs already added to local state (both loaded from history and sent in this session)
- When Realtime fires, messages already in `seenIds` are skipped — preventing duplicates from our own agent calls
- Agent messages now return their real DB `id` from the API so they can be tracked before Realtime fires
- The subscription is cleaned up on component unmount
