# AsuraScans.com Scraping API

A zero-dependency scraping API for [asurascans.com](https://asurascans.com) that extracts data from the site's server-rendered HTML pages. Includes a live API explorer UI to test every endpoint in the browser.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api` or `/api/home` | Home page data: trending manga and featured series |
| GET | `/api/browse?page=1&name=solo&genres=action&status=ongoing&type=manhwa` | Browse/filter manga with pagination |
| GET | `/api/search?q=solo&page=1` | Search manga by name |
| GET | `/api/manga/:slug` | Manga detail: title, cover, rating, status, type, artist, genres, synopsis, full chapter list |
| GET | `/api/chapter/:slug/:chapterNumber` | Chapter page images as direct CDN URLs |
| GET | `/api/series-ranking` | Top ranked manga |

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

asurascans.com is an Astro SSR site. All manga data is in server-rendered HTML. The scraper fetches each page and uses regex to extract:

- **Home**: Trending carousel and featured manga from the homepage
- **Browse**: Manga cards with cover, rating, chapter count, and status from `/browse`
- **Search**: Filtered results from `/browse?name=...`
- **Manga Detail**: Title, cover, rating, status, type, artist, genres, synopsis, and full chapter list from `/comics/:slug`
- **Chapter Pages**: Direct CDN image URLs from `cdn.asurascans.com` embedded in chapter pages

## Tech Stack

- Node.js built-in `http` module (zero runtime dependencies for the API)
- Vite + React + TypeScript + Tailwind CSS (for the explorer UI)
- lucide-react for icons
