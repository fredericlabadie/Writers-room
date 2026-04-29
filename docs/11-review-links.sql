-- ── Review links — room sharing ───────────────────────────────────────────────
-- Separate from the JWT-based AI review mode (/api/review/token).
-- These are shareable read-only links to a specific room's conversation.

CREATE TABLE IF NOT EXISTS review_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid REFERENCES rooms(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  created_by  text REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_links_token_idx ON review_links(token);
CREATE INDEX IF NOT EXISTS review_links_room_id_idx ON review_links(room_id);

ALTER TABLE review_links ENABLE ROW LEVEL SECURITY;
