// AsuraScans.com Scraping API — zero-dependency Node HTTP server.
// Works as a long-running server on Render/Heroku/Railway AND as Vercel
// serverless functions (each handler is exported separately).

import {
  scrapeHome,
  scrapeBrowse,
  scrapeSearch,
  scrapeMangaDetail,
  scrapeChapter,
  scrapeSeriesRanking,
  BASE,
} from "./scraper.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60",
};

function send(res, status, body) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body, null, 2));
}

function sendError(res, status, message) {
  send(res, status, { error: message, status });
}

async function handleHome() {
  return { status: 200, body: await scrapeHome() };
}

async function handleBrowse(req) {
  const page = parseInt(req.query.page) || 1;
  const data = await scrapeBrowse({
    page,
    name: req.query.name,
    genres: req.query.genres,
    status: req.query.status,
    type: req.query.type,
    sort: req.query.sort,
  });
  return { status: data.error ? 500 : 200, body: data };
}

async function handleSearch(req) {
  const page = parseInt(req.query.page) || 1;
  const query = req.query.q || req.query.name || req.query.query;
  if (!query) return { status: 400, body: { error: "Missing search query (?q=...)" } };
  const data = await scrapeSearch(query, page);
  return { status: data.error ? 500 : 200, body: data };
}

async function handleMangaDetail(req) {
  const data = await scrapeMangaDetail(req.params.slug);
  return { status: data.error ? 404 : 200, body: data };
}

async function handleChapter(req) {
  const data = await scrapeChapter(req.params.slug, req.params.chapter);
  return { status: data.error ? 404 : 200, body: data };
}

async function handleSeriesRanking() {
  const data = await scrapeSeriesRanking();
  return { status: data.error ? 500 : 200, body: data };
}

const ROUTES = [
  ["GET", /^\/api\/?$/, handleHome, "GET /api — Home page data (trending & featured manga)"],
  ["GET", /^\/api\/home\/?$/, handleHome, "GET /api/home — Same as /api"],
  ["GET", /^\/api\/browse\/?$/, handleBrowse, "GET /api/browse?page=1&name=solo&genres=action&status=ongoing&type=manhwa — Browse/filter manga with pagination"],
  ["GET", /^\/api\/search\/?$/, handleSearch, "GET /api/search?q=solo&page=1 — Search manga by name"],
  ["GET", /^\/api\/manga\/([^/]+)\/?$/, handleMangaDetail, "GET /api/manga/:slug — Manga detail with chapters, genres, rating, status, type"],
  ["GET", /^\/api\/chapter\/([^/]+)\/([^/]+)\/?$/, handleChapter, "GET /api/chapter/:slug/:chapterNumber — Chapter page images (direct CDN URLs)"],
  ["GET", /^\/api\/series-ranking\/?$/, handleSeriesRanking, "GET /api/series-ranking — Top ranked manga"],
];

function parseUrl(req) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const query = Object.fromEntries(url.searchParams.entries());
  return { pathname: url.pathname, query };
}

function matchRoute(method, pathname) {
  for (const [m, pattern, handler, desc] of ROUTES) {
    if (m !== method) continue;
    const match = pathname.match(pattern);
    if (match) {
      const params = {};
      if (desc.includes(":slug") && desc.includes(":chapterNumber")) {
        params.slug = decodeURIComponent(match[1]);
        params.chapter = decodeURIComponent(match[2]);
      } else if (desc.includes(":slug")) {
        params.slug = decodeURIComponent(match[1]);
      }
      return { handler, params, desc };
    }
  }
  return null;
}

async function handleRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, JSON_HEADERS);
    res.end();
    return;
  }
  const { pathname, query } = parseUrl(req);
  if (pathname === "/" || pathname === "/api" || pathname === "/api/") {
    send(res, 200, {
      name: "AsuraScans Scraping API",
      version: "1.0.0",
      base: BASE,
      endpoints: ROUTES.map(([m, , , desc]) => desc),
      note: "All data is scraped from asurascans.com server-rendered HTML. Chapter images are direct CDN URLs.",
    });
    return;
  }
  const matched = matchRoute(req.method, pathname);
  if (!matched) {
    sendError(res, 404, `Route not found: ${req.method} ${pathname}. Visit / for available endpoints.`);
    return;
  }
  req.query = query;
  req.params = matched.params;
  try {
    const { status, body } = await matched.handler(req);
    send(res, status, body);
  } catch (err) {
    sendError(res, 500, `Internal error: ${err.message}`);
  }
}

import http from "node:http";

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      await handleRequest(req, res);
    } catch (err) {
      try { sendError(res, 500, `Server error: ${err.message}`); } catch { res.end(); }
    }
  });
}

export default async function handler(req, res) {
  await handleRequest(req, res);
}

if (process.env.NODE_ENV !== "production" || process.env.RUN_AS_SERVER) {
  const PORT = process.env.PORT || 3001;
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`AsuraScans API server running on http://localhost:${PORT}`);
    console.log(`Try: http://localhost:${PORT}/`);
  });
}
