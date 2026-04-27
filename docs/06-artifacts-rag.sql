-- Step 6 schema: artifacts + RAG + review metadata
-- Run in Supabase SQL Editor after Step 5.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- Uploaded artifacts per room
create table if not exists artifacts (
  id uuid default gen_random_uuid() primary key,
  room_id uuid not null references rooms(id) on delete cascade,
  uploaded_by text references profiles(id) on delete set null,
  name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_path text not null unique,
  kind text not null check (kind in ('document', 'image')),
  parse_status text not null default 'pending' check (parse_status in ('pending', 'processing', 'ready', 'failed')),
  parse_error text,
  created_at timestamptz default now()
);

create index if not exists artifacts_room_id_created_at_idx on artifacts (room_id, created_at desc);

-- Mapping between user messages and explicitly attached artifacts
create table if not exists message_artifacts (
  message_id uuid not null references messages(id) on delete cascade,
  artifact_id uuid not null references artifacts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (message_id, artifact_id)
);

create index if not exists message_artifacts_artifact_id_idx on message_artifacts (artifact_id);

-- Chunked text + embedding vectors used for retrieval
create table if not exists artifact_chunks (
  id uuid default gen_random_uuid() primary key,
  artifact_id uuid not null references artifacts(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(256) not null,
  created_at timestamptz default now(),
  unique (artifact_id, chunk_index)
);

create index if not exists artifact_chunks_room_id_idx on artifact_chunks (room_id);
create index if not exists artifact_chunks_artifact_id_idx on artifact_chunks (artifact_id);

-- Approximate nearest-neighbor index for vector search
create index if not exists artifact_chunks_embedding_ivfflat_idx
  on artifact_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Optional citations payload on agent messages
alter table messages
  add column if not exists citations jsonb not null default '[]'::jsonb;

alter table messages
  add column if not exists retrieval_debug jsonb;

-- Section-level tone controls powered by Spotify mood extraction
create table if not exists room_sections (
  id uuid default gen_random_uuid() primary key,
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null,
  created_by text references profiles(id) on delete set null,
  spotify_url text,
  spotify_track_id text,
  spotify_track_name text,
  spotify_artist_name text,
  mood_profile jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (room_id, name)
);

create index if not exists room_sections_room_id_idx on room_sections (room_id);

alter table messages
  add column if not exists section_id uuid references room_sections(id) on delete set null;

-- Enable RLS (service-role key bypasses this in API routes)
alter table artifacts enable row level security;
alter table message_artifacts enable row level security;
alter table artifact_chunks enable row level security;
alter table room_sections enable row level security;

-- Basic room-member policies
drop policy if exists "room_members_can_read_artifacts" on artifacts;
create policy "room_members_can_read_artifacts"
  on artifacts for select
  using (
    exists (
      select 1
      from room_members rm
      where rm.room_id = artifacts.room_id
        and rm.user_id = auth.uid()::text
    )
  );

drop policy if exists "room_members_can_insert_artifacts" on artifacts;
create policy "room_members_can_insert_artifacts"
  on artifacts for insert
  with check (
    exists (
      select 1
      from room_members rm
      where rm.room_id = artifacts.room_id
        and rm.user_id = auth.uid()::text
    )
  );

drop policy if exists "room_members_can_read_message_artifacts" on message_artifacts;
create policy "room_members_can_read_message_artifacts"
  on message_artifacts for select
  using (
    exists (
      select 1
      from artifacts a
      join room_members rm on rm.room_id = a.room_id
      where a.id = message_artifacts.artifact_id
        and rm.user_id = auth.uid()::text
    )
  );

drop policy if exists "room_members_can_read_artifact_chunks" on artifact_chunks;
create policy "room_members_can_read_artifact_chunks"
  on artifact_chunks for select
  using (
    exists (
      select 1
      from room_members rm
      where rm.room_id = artifact_chunks.room_id
        and rm.user_id = auth.uid()::text
    )
  );

drop policy if exists "room_members_can_read_sections" on room_sections;
create policy "room_members_can_read_sections"
  on room_sections for select
  using (
    exists (
      select 1
      from room_members rm
      where rm.room_id = room_sections.room_id
        and rm.user_id = auth.uid()::text
    )
  );

drop policy if exists "room_members_can_insert_sections" on room_sections;
create policy "room_members_can_insert_sections"
  on room_sections for insert
  with check (
    exists (
      select 1
      from room_members rm
      where rm.room_id = room_sections.room_id
        and rm.user_id = auth.uid()::text
    )
  );

-- Create private bucket for artifacts
insert into storage.buckets (id, name, public)
values ('artifacts', 'artifacts', false)
on conflict (id) do nothing;
