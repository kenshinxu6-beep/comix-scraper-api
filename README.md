# Comix.to Scraping API

A zero-dependency scraping API for [comix.to](https://comix.to) that extracts data from the site's server-rendered HTML pages. Includes a live API explorer UI to test every endpoint in the browser.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api` or `/api/home` | Home page data: trending, hot, latest, comments, collections, top uploaders |
| GET | `/api/genres` | All genres and demographics with counts |
| GET | `/api/manga/:hid` | Manga detail, recommendations, and groups (by hid or full slug) |
| GET | `/api/chapter/:hid/:chapterSlug` | Chapter read metadata and parent manga |
| GET | `/api/collections` | Collections listing (from HTML page) |
| GET | `/api/collections/list?sort=trending&page=1&limit=20` | Paginated collections via upstream API |
| GET | `/api/collection/:id` | Collection detail by id |
| GET | `/api/comments?page=1&limit=20` | Recent site-wide comments |
| GET | `/api/profile/:hashId` | User profile by hashId |

## Running Locally

```bash
npm install
npm run dev:all   # starts API server (port 3999) + Vite dev server (port 9091)
```

Or run them separately:
```bash
npm run api    # API server only on port 3999
npm run dev    # Vite dev server only (proxies /api to 3999)
```

## Deploy on Vercel

1. Push this repo to GitHub.
2. Import it on [vercel.com](https://vercel.com).
3. Vercel auto-detects Vite. The `vercel.json` rewrites `/api/*` to the serverless function at `api/server.js`.
4. Deploy. The API is available at `https://your-domain.vercel.app/api/...`

## Deploy on Render

1. Push this repo to GitHub.
2. Create a new Web Service on [render.com](https://render.com).
3. Use the included `render.yaml` or set:
   - Build Command: `npm install`
   - Start Command: `node api/server.js`
   - Environment variable: `RUN_AS_SERVER=1`
4. Deploy. The API is available at `https://your-service.onrender.com/api/...`

## How It Works

Comix.to is a single-page app that embeds all page data as JSON inside a `<script type="application/json" id="initial-data">` tag in the server-rendered HTML. The scraper fetches each page, extracts this JSON block, and returns it as a clean API response.

Some endpoints (comments, collections list) use comix.to's public upstream API directly (`/api/v1/comments`, `/api/v1/collections`) which don't require authentication.

**Note:** Chapter page images are loaded via a token-gated API protected by anti-bot JavaScript. They are not available through this scraping API.

## Tech Stack

- Node.js built-in `http` module (zero runtime dependencies for the API)
- Vite + React + TypeScript + Tailwind CSS (for the explorer UI)
- lucide-react for icons
