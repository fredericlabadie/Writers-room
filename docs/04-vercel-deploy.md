# Step 4 — Vercel Deploy

Vercel is the best host for Next.js. The free tier is more than enough for this project.

---

## 4.1 Create a Vercel account

Go to [vercel.com](https://vercel.com) and sign up with your GitHub account. This connects your repos automatically.

---

## 4.2 Import the project

1. In the Vercel dashboard, click **Add New → Project**
2. Find `fredericlabadie/writers-room` in the list and click **Import**
3. On the configuration screen:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `./` (leave as-is)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
4. **Do not click Deploy yet** — add environment variables first

---

## 4.3 Add environment variables

Still on the configuration screen, scroll down to **Environment Variables**.

Add each of these one by one (copy from your `.env.local`):

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` |
| `AUTH_SECRET` | your generated secret |
| `NEXTAUTH_URL` | `https://writersroom.fredericlabadie.com` |
| `AUTH_GOOGLE_ID` | `xxxx.apps.googleusercontent.com` |
| `AUTH_GOOGLE_SECRET` | `GOCSPX-...` |
| `AUTH_GITHUB_ID` | `xxxx` |
| `AUTH_GITHUB_SECRET` | `xxxx` |

> For `NEXTAUTH_URL`, use your subdomain (not the `.vercel.app` URL) since we'll be setting up the custom domain.

---

## 4.4 Deploy

Click **Deploy**. Vercel will:
1. Pull your code from GitHub
2. Install dependencies
3. Build the Next.js app
4. Deploy to a `.vercel.app` URL

The first build takes 1–2 minutes. You'll see a live URL like `writers-room-xyz.vercel.app`.

> If the build fails, click on the failed deployment to see the error log. The most common cause is a missing environment variable.

---

## 4.5 Add your custom domain

1. In your project dashboard, go to **Settings → Domains**
2. Type `writersroom.fredericlabadie.com` and click **Add**
3. Vercel will show you a DNS record to add — it'll look like:

```
Type:  CNAME
Name:  writersroom
Value: cname.vercel-dns.com
```

Keep this screen open — you'll need these values in the next step.

---

## 4.6 Auto-deploy on push

From now on, every `git push` to `main` will trigger a new deploy automatically. You don't need to do anything in Vercel.

```bash
git add .
git commit -m "update personas"
git push
```

Vercel picks it up within seconds.

---

**Next:** [Step 5 — Scaleway DNS](./05-scaleway-dns.md)
