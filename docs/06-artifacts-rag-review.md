# Step 6 — Artifacts, RAG, and AI Review Mode

This step enables:

- Room-level artifact uploads (`txt`, `md`, `pdf`, `docx`, and images)
- Retrieval-augmented generation (RAG) in agent replies
- Signed review-token access for Claude/other AIs to inspect full site flows

---

## 6.1 Run the SQL schema

1. Open Supabase → **SQL Editor**
2. Open [`06-artifacts-rag.sql`](./06-artifacts-rag.sql)
3. Paste and run the script

This creates:

- `artifacts`
- `artifact_chunks`
- `message_artifacts`
- `messages.citations` column
- private storage bucket `artifacts`

---

## 6.2 Configure environment variables

In `.env.local` and Vercel project env vars:

```env
REVIEW_MODE_ENABLED=true
REVIEW_TOKEN_SECRET=use-a-long-random-secret
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

You can generate a secret with:

```bash
openssl rand -base64 32
```

---

## 6.3 Upload and index artifacts

Inside a room:

1. Click `FILES`
2. Upload a document or image
3. Wait until status is `READY`
4. Check artifacts when using `selected-only` retrieval mode

When you message `@writer`/`@editor`/etc, relevant chunks are injected into prompt context and cited in responses.

### Retrieval controls in chat

Near the message composer you can tune:

- **Mode**
  - `room-wide` (default): search all indexed artifacts in the room.
  - `selected-only`: search only checked artifacts in the `FILES` panel.
- **TopK**: maximum number of chunks included.
- **Threshold**: minimum similarity score required.

Each agent reply now includes a small retrieval debug line (`mode`, chunks used, threshold, max score).

---

## 6.4 Section tone from Spotify links

Inside a room composer:

1. Add/select a section in `Section Tone`
2. Paste a Spotify track link
3. Click `EXTRACT MOOD`
4. The extracted mood profile is injected when sending prompts with that section selected

Supported links:

- `https://open.spotify.com/track/...`
- `spotify:track:...`

---

## 6.5 Create a review token for AI auditors

Call:

```bash
curl -X POST https://your-domain/api/review/token \
  -H "Content-Type: application/json" \
  -d '{"write":false,"expiresInSeconds":3600,"label":"Claude Review"}'
```

Response includes:

- `token`
- `reviewUrl` (open this to start scoped review mode)

Share the review URL with Claude/other AIs.

---

## 6.6 Validate end-to-end

- Upload `txt/md/pdf/docx` and image files successfully
- Confirm `artifacts.parse_status` becomes `ready` for docs/images
- Send prompts with:
  - `room-wide` mode and no selected artifacts,
  - `selected-only` mode with checked artifacts,
  and verify citations + retrieval debug metadata.
- Confirm non-members cannot list/upload artifacts.
- Confirm non-owners cannot preview chunks, re-index, or delete artifacts.
- Confirm owners can preview chunks and re-index failed artifacts.
- Create a section, extract mood from a Spotify track, and verify section tone appears in generated responses.
- Confirm review token grants read access and expires correctly
- Confirm write attempts fail when token scope is read-only

---

## 6.7 Troubleshooting retrieval quality

- **No chunks retrieved**
  - Lower threshold (for example `0.14 -> 0.08`).
  - Increase `TopK`.
  - Confirm artifact status is `READY`.
- **Wrong context chosen**
  - Switch to `selected-only` and choose exact source files.
  - Use chunk preview (`CHUNKS`) to verify indexed text.
- **Artifact failed to parse**
  - Open `FILES` and click `REINDEX` (owner only).
  - Check `parse_error` in the artifact row/API response.
