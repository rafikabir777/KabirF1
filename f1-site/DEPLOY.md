# F1 2026 Hub — Netlify Deployment Guide

## Folder structure
```
f1-site/
├── index.html                        ← your site (no keys inside)
├── netlify.toml                      ← Netlify config
└── netlify/
    └── functions/
        └── supabase-proxy.js         ← serverless proxy (keys live here via env vars)
```

---

## Step 1 — Push to GitHub (required for env vars to work)

Netlify reads environment variables at build/deploy time,
so you need a GitHub repo (free).

1. Go to github.com → New repository → name it `f1-2026-hub` → Create
2. On your computer, open a terminal in the `f1-site/` folder:

```bash
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/f1-2026-hub.git
git push -u origin main
```

---

## Step 2 — Deploy on Netlify

1. Go to app.netlify.com → Add new site → Import from Git → GitHub
2. Pick your `f1-2026-hub` repo
3. Build settings are auto-detected from `netlify.toml` — just click **Deploy site**

---

## Step 3 — Add environment variables (this is the key step)

After deploy, go to:
**Site configuration → Environment variables → Add a variable**

Add these three:

| Key                | Value                                      |
|--------------------|--------------------------------------------|
| `SUPABASE_URL`     | `https://xxxx.supabase.co`                 |
| `SUPABASE_ANON_KEY`| `eyJhbGc...` (your anon/public key)        |
| `SITE_URL`         | `https://your-site-name.netlify.app`       |

Get `SUPABASE_URL` and `SUPABASE_ANON_KEY` from:
**Supabase → Settings → API**

---

## Step 4 — Trigger a redeploy

After adding env vars, go to **Deploys → Trigger deploy → Deploy site**.
The function will now have access to the keys.

---

## Step 5 — Update Supabase allowed origins

Go to **Supabase → Authentication → URL Configuration**:
- Site URL: `https://your-site-name.netlify.app`
- Redirect URLs: `https://your-site-name.netlify.app/**`

---

## How it works

```
Browser (no keys)
     │
     │  fetch('/.netlify/functions/supabase-proxy?path=/rest/v1/comments')
     ▼
Netlify Edge Function  ← reads SUPABASE_URL + SUPABASE_ANON_KEY from env
     │
     │  fetch('https://xxxx.supabase.co/rest/v1/comments', { apikey: ... })
     ▼
Supabase (database)
```

The browser never sees your Supabase URL or key.
Even opening DevTools → Network will only show calls to your own Netlify domain.

---

## Local development

To test locally with the Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev
```

Create a `.env` file in `f1-site/`:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SITE_URL=http://localhost:8888
```

The site runs at http://localhost:8888 with the function at
http://localhost:8888/.netlify/functions/supabase-proxy
