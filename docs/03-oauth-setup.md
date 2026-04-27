# Step 3 — OAuth Setup (Google + GitHub)

You need OAuth apps on both platforms. Each one takes about 5 minutes.

The callback URL pattern is:
```
https://writersroom.fredericlabadie.com/api/auth/callback/[provider]
```

For local dev, you'll also need:
```
http://localhost:3000/api/auth/callback/[provider]
```

---

## 3.1 Google OAuth

### Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Name it `writers-room` → **Create**
4. Make sure the new project is selected in the dropdown

### Enable the API

1. In the sidebar: **APIs & Services → Library**
2. Search for "Google+ API" → Enable it (or "Google Identity")

### Create OAuth credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. If prompted, configure the consent screen first:
   - **User Type:** External
   - **App name:** Writers Room
   - **User support email:** your email
   - **Developer contact:** your email
   - Save and continue through all steps
3. Back to **Create OAuth client ID**:
   - **Application type:** Web application
   - **Name:** Writers Room
   - **Authorized JavaScript origins:**
     ```
     https://writersroom.fredericlabadie.com
     http://localhost:3000
     ```
   - **Authorized redirect URIs:**
     ```
     https://writersroom.fredericlabadie.com/api/auth/callback/google
     http://localhost:3000/api/auth/callback/google
     ```
4. Click **Create**

Copy the **Client ID** and **Client Secret** into `.env.local`:

```env
AUTH_GOOGLE_ID=xxxx.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=GOCSPX-xxxx
```

---

## 3.2 GitHub OAuth

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **OAuth Apps → New OAuth App**
3. Fill in:
   - **Application name:** Writers Room
   - **Homepage URL:** `https://writersroom.fredericlabadie.com`
   - **Authorization callback URL:** `https://writersroom.fredericlabadie.com/api/auth/callback/github`
4. Click **Register application**
5. On the next page, click **Generate a new client secret**

Copy both values into `.env.local`:

```env
AUTH_GITHUB_ID=your_client_id
AUTH_GITHUB_SECRET=your_client_secret
```

> ⚠️ For local dev, create a **second** GitHub OAuth app with callback URL `http://localhost:3000/api/auth/callback/github`. Keep separate `.env.local` values for local vs. production, or add both redirect URIs to the same app.

---

## 3.3 Generate NextAuth secret

Run this in your terminal:

```bash
openssl rand -base64 32
```

Copy the output into `.env.local`:

```env
AUTH_SECRET=the_output_from_above
NEXTAUTH_URL=https://writersroom.fredericlabadie.com
```

For local dev, temporarily set `NEXTAUTH_URL=http://localhost:3000`.

---

## 3.4 Get your Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. **API Keys → Create Key**
3. Copy it into `.env.local`:

```env
ANTHROPIC_API_KEY=sk-ant-xxxx
```

---

## 3.5 Your completed .env.local

At this point, all values in `.env.local` should be filled in. It should look like:

```env
ANTHROPIC_API_KEY=sk-ant-...

NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

AUTH_SECRET=your-generated-secret
NEXTAUTH_URL=https://writersroom.fredericlabadie.com

AUTH_GOOGLE_ID=xxxx.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=GOCSPX-...

AUTH_GITHUB_ID=xxxx
AUTH_GITHUB_SECRET=xxxx
```

---

## 3.6 Test locally

```bash
npm run dev
```

Open `http://localhost:3000`. You should be redirected to `/login`. Try signing in with both Google and GitHub.

> If you get an OAuth error, double-check that your callback URLs in both Google Console and GitHub exactly match the format above (no trailing slashes).

---

**Next:** [Step 4 — Vercel Deploy](./04-vercel-deploy.md)
