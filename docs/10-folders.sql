-- ── Folder system — Writers Room ─────────────────────────────────────────────
-- Run these in order in the Supabase SQL editor.
-- Folders are project containers; rooms are chapters inside them.
-- Folder lore (about, reader, tone, pins) cascades into every agent call.

-- 1. Folders table
CREATE TABLE IF NOT EXISTS folders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  owner_id    text REFERENCES profiles(id) ON DELETE CASCADE,
  genre       text,
  reader      text,    -- comp titles / target reader
  tone        text,
  about       text,
  created_at  timestamptz DEFAULT now()
);

-- 2. Folder members (for sharing folders across collaborators)
CREATE TABLE IF NOT EXISTS folder_members (
  folder_id  uuid REFERENCES folders(id) ON DELETE CASCADE,
  user_id    text REFERENCES profiles(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
  joined_at  timestamptz DEFAULT now(),
  PRIMARY KEY (folder_id, user_id)
);

-- 3. Folder pins (Director directions that cascade into all rooms)
CREATE TABLE IF NOT EXISTS folder_pins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id   uuid REFERENCES folders(id) ON DELETE CASCADE,
  text        text NOT NULL,
  created_by  text REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- 4. Add folder_id to rooms
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS folders_owner_id_idx ON folders(owner_id);
CREATE INDEX IF NOT EXISTS folder_members_user_id_idx ON folder_members(user_id);
CREATE INDEX IF NOT EXISTS folder_pins_folder_id_idx ON folder_pins(folder_id);
CREATE INDEX IF NOT EXISTS rooms_folder_id_idx ON rooms(folder_id);

-- 6. RLS — mirror rooms pattern: service role only (no direct client access)
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_pins ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — the app always uses service role key
-- No additional policies needed (same pattern as rooms/messages tables)
