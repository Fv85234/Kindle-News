# Kindle News Daily Digest

Personal daily news delivery for Kindle. The app gathers reputable coverage from the previous day, ranks the most relevant stories for one reader profile, extracts clean article text, generates a Kindle-friendly EPUB, and emails it to your Kindle address.

## Stack

- Next.js 15 with TypeScript
- Vercel Blob persistence in production, local JSON fallback in development
- RSS ingestion plus article extraction
- EPUB generation with Kindle-oriented styling
- SMTP email delivery
- Optional OpenAI reranking for the final shortlist

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
cp .env.example .env.local
```

If you want production-like persistence locally, add `BLOB_READ_WRITE_TOKEN`. If you leave it empty, the app uses local files under `data/`.

3. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Important routes

- `/` admin UI for profile settings and delivery history
- `PUT /api/settings` save digest settings
- `POST /api/digest/run` manually run the daily pipeline
- `GET /api/cron/daily` scheduler entrypoint

## Scheduling

`vercel.json` calls `/api/cron/daily` twice per day: `09:00 UTC` and `10:00 UTC`. On Vercel Hobby, each cron expression must run at most once per day, so this dual-UTC setup is how the app stays aligned with `11:00 Europe/Madrid` across winter and summer time. The route itself checks the saved timezone and delivery hour and only sends when the local hour is actually `11`.

## Deploy

For a real hosted deployment, add these environment variables in Vercel:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `OPENAI_API_KEY`
- `OPENAI_RANKING_MODEL`
- `CRON_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `BLOB_STORE_ACCESS`

`BLOB_READ_WRITE_TOKEN` comes from a Vercel Blob store. Without it, the app falls back to ephemeral local storage, which is fine for local development but not for a persistent hosted app. Set `BLOB_STORE_ACCESS=public` for a public Blob store or `BLOB_STORE_ACCESS=private` for a private one.

## Notes

- Kindle delivery requires the `senderEmail` address to be approved in Amazon Kindle settings.
- If `OPENAI_API_KEY` is missing, the app falls back to deterministic heuristic ranking.
- If SMTP is missing, manual runs will fail after EPUB creation, and the failure will be recorded in history.
