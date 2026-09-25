# Disha News Backend

Small Express server that fetches top headlines from NewsAPI, caches them for
15 minutes, and returns only short, copyright-safe fields (title, short
description, source name, link) — never the full article text.

## 1. Get a fresh API key
Go to https://newsapi.org, sign up, and copy your key.
(If you shared a key anywhere publicly before, regenerate it — treat any
previously-shared key as compromised.)

## 2. Local setup
```bash
npm install
cp .env.example .env
# open .env and paste your key into NEWS_API_KEY=
npm start
```
Visit http://localhost:3000/api/news?cat=भारत to test.

## 3. Deploy for free (so the site works from anywhere, 24/7)
Recommended: **Render.com**
1. Push this folder to a GitHub repo (add `.env` to `.gitignore` — never commit it)
2. On Render: New → Web Service → connect your repo
3. Build command: `npm install`
4. Start command: `npm start`
5. In Render's dashboard, add an Environment Variable: `NEWS_API_KEY` = your key
6. Deploy — Render gives you a live URL like `https://disha-news.onrender.com`

Alternatives: Railway.app, Cyclic.sh — same idea (env variable + deploy).

## 4. Connect it to the frontend
In `news-site.html`, replace the sample data fetch with a call to your
deployed backend, e.g.:
```js
const res = await fetch("https://YOUR-BACKEND-URL/api/news?cat=" + category);
const data = await res.json();
```

## Notes on copyright
- Only headline + short description + source + link are served — this is the
  standard, safe pattern news aggregators use.
- Never scrape or forward full article bodies.
- Always keep the "source" link visible and clickable so readers can go to
  the original publisher.
