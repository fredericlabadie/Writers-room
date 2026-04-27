# Step 5 — Scaleway DNS (subdomain setup)

This step points `writersroom.fredericlabadie.com` at your Vercel deployment.

---

## 5.1 Log into Scaleway

Go to [console.scaleway.com](https://console.scaleway.com) and log in.

---

## 5.2 Find your domain's DNS zone

1. In the left sidebar, go to **Network → Domains and DNS**
2. Find `fredericlabadie.com` in your list of domains and click it
3. Click the **DNS Zones** tab
4. Click on the root zone for `fredericlabadie.com`

You'll see a list of existing DNS records for your domain.

---

## 5.3 Add the CNAME record

Click **+ Add record** and fill in:

| Field | Value |
|---|---|
| **Record type** | `CNAME` |
| **Name** | `writersroom` |
| **TTL** | `3600` (or leave default) |
| **Target / Value** | `cname.vercel-dns.com.` ← *note the trailing dot* |

Click **Save** or **Add record**.

> The trailing dot at the end of `cname.vercel-dns.com.` is standard DNS notation for a fully qualified domain name. Scaleway may add it automatically or require it explicitly.

---

## 5.4 Wait for DNS propagation

DNS changes typically propagate in **5–30 minutes**, but can take up to 48 hours in rare cases.

To check if it's working, run this from your terminal:

```bash
dig writersroom.fredericlabadie.com CNAME
```

You should eventually see:
```
writersroom.fredericlabadie.com. 3600 IN CNAME cname.vercel-dns.com.
```

Or use the online checker at [dnschecker.org](https://dnschecker.org) — search for `writersroom.fredericlabadie.com` with record type `CNAME`.

---

## 5.5 Verify in Vercel

Go back to Vercel → **Settings → Domains**.

Once DNS has propagated, the status next to `writersroom.fredericlabadie.com` will change from **"Invalid configuration"** to a green checkmark. Vercel will also automatically provision an SSL certificate (this is instant once DNS resolves).

---

## 5.6 Full end-to-end test

1. Open `https://writersroom.fredericlabadie.com`
2. You should see the login page with Google + GitHub buttons
3. Sign in with either provider
4. Create a room and test the agents

---

## Troubleshooting

**"Too many redirects" error:**  
Check that `NEXTAUTH_URL` in Vercel's environment variables matches exactly `https://writersroom.fredericlabadie.com` (no trailing slash).

**SSL certificate error:**  
Wait a few more minutes. Vercel provisions certs automatically but it requires DNS to fully resolve first.

**OAuth callback error after switching to the custom domain:**  
Go back to Google Cloud Console and GitHub OAuth settings and confirm that `https://writersroom.fredericlabadie.com/api/auth/callback/google` (and `/github`) are in the authorized redirect URIs.

**Vercel still shows "Invalid configuration" after 1 hour:**  
In Scaleway, double-check the CNAME record. Make sure the Name is exactly `writersroom` (not `writersroom.fredericlabadie.com`) and the target is `cname.vercel-dns.com.`

---

## You're live 🎉

`writersroom.fredericlabadie.com` is now a fully deployed, authenticated, multi-agent writers room.

To add collaborators, share your room's invite code (visible in the room header).
