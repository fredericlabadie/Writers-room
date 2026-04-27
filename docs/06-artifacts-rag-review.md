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
4. Check the artifact to include it in retrieval

When you message `@writer`/`@editor`/etc, relevant chunks are injected into prompt context and cited in responses.

---

## 6.4 Create a review token for AI auditors

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

## 6.5 Validate end-to-end

- Upload `txt/md/pdf/docx` and image files successfully
- Confirm `artifacts.parse_status` becomes `ready` for docs/images
- Send a prompt with selected artifacts; verify agent citations appear
- Confirm non-members cannot list/upload/delete artifacts
- Confirm review token grants read access and expires correctly
- Confirm write attempts fail when token scope is read-only
