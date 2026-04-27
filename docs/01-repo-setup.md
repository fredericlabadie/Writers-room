# Step 1 — Repo & Local Setup

## 1.1 Create the GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. Set:
   - **Owner:** `fredericlabadie`
   - **Repository name:** `writers-room`
   - **Visibility:** Public *(better for portfolio)*
   - **Initialize with README:** No (we'll push our own)
3. Click **Create repository**

You'll land on an empty repo page. Leave it open.

---

## 1.2 Set up your local machine

You need Node.js 18+ and Git. Check:

```bash
node --version   # should be v18 or higher
git --version
```

If Node is missing, install it from [nodejs.org](https://nodejs.org) (LTS version).

---

## 1.3 Get the project files onto your machine

If you downloaded this project as a zip, unzip it to a folder called `writers-room`.

If you want to start fresh from this repo:

```bash
git clone https://github.com/fredericlabadie/writers-room.git
cd writers-room
```

---

## 1.4 Install dependencies

```bash
npm install
```

This will install Next.js, Supabase, NextAuth, Anthropic SDK, and all other dependencies listed in `package.json`.

---

## 1.5 Create your local environment file

```bash
cp .env.example .env.local
```

Open `.env.local` in your editor. You'll fill in each value during the next steps. For now, leave them as placeholders — the app won't run until all values are present.

---

## 1.6 Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/fredericlabadie/writers-room.git
git push -u origin main
```

If prompted, authenticate with your GitHub credentials (or a personal access token if you have 2FA enabled).

---

## 1.7 Verify

Go to `https://github.com/fredericlabadie/writers-room` — you should see all the files.

**Next:** [Step 2 — Supabase Setup](./02-supabase-setup.md)
