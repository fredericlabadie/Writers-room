# Step 2 — Supabase Setup

Supabase gives you a free Postgres database. It stores rooms, messages, and user profiles.

---

## 2.1 Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (you can use your GitHub account)
2. Click **New project**
3. Set:
   - **Organization:** your personal org
   - **Name:** `writers-room`
   - **Database password:** generate a strong one and save it somewhere safe
   - **Region:** choose one close to Europe (e.g. `eu-west-1`)
4. Click **Create new project** and wait ~2 minutes for it to provision

---

## 2.2 Get your API keys

Once the project is ready:

1. In the Supabase sidebar, go to **Project Settings → API**
2. Copy these three values into your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

> ⚠️ The service role key has full database access. Never expose it in client-side code. In this project it's only used in server-side API routes.

---

## 2.3 Run the database schema

1. In the Supabase sidebar, go to **SQL Editor**
2. Click **New query**
3. Paste the entire SQL block below and click **Run**:

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

-- User profiles (linked to NextAuth users)
create table profiles (
  id           text primary key,
  name         text,
  avatar_url   text,
  created_at   timestamptz default now()
);

-- Rooms
create table rooms (
  id           uuid default gen_random_uuid() primary key,
  name         text not null,
  description  text,
  owner_id     text references profiles(id) on delete set null,
  is_private   boolean default false,
  invite_code  text unique,
  created_at   timestamptz default now()
);

-- Room membership
create table room_members (
  room_id    uuid references rooms(id) on delete cascade,
  user_id    text references profiles(id) on delete cascade,
  role       text default 'member' check (role in ('owner','member')),
  joined_at  timestamptz default now(),
  primary key (room_id, user_id)
);

-- Messages (user + agent)
create table messages (
  id          uuid default gen_random_uuid() primary key,
  room_id     uuid references rooms(id) on delete cascade,
  role        text not null check (role in ('user','agent')),
  persona     text,
  user_id     text references profiles(id) on delete set null,
  content     text not null,
  created_at  timestamptz default now()
);

-- Index for fast message loading
create index messages_room_id_created_at on messages (room_id, created_at);

-- Row level security (basic — service role bypasses these)
alter table profiles   enable row level security;
alter table rooms      enable row level security;
alter table room_members enable row level security;
alter table messages   enable row level security;
```

You should see "Success. No rows returned."

---

## 2.4 Verify the tables exist

In the Supabase sidebar, go to **Table Editor**. You should see:
- `profiles`
- `rooms`
- `room_members`
- `messages`

---

**Next:** [Step 3 — OAuth Setup](./03-oauth-setup.md)
