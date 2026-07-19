// Comix.to Scraping API — zero-dependency Node HTTP server.
// Works as a long-running server on Render/Heroku/Railway AND as Vercel
// serverless functions (each handler is exported separately).

import {
  scrapeHome,
  scrapeMangaDetail,
  scrapeChapter,
  scrapeGenres,
  scrapeCollectionsList,
  scrapeCollectionDetail,
  scrapeProfile,
  getComments,
  getCollections,
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

async function handleMangaDetail(req) {
  const data = await scrapeMangaDetail(req.params.hid);
  return { status: data.error ? 404 : 200, body: data };
}

async function handleChapter(req) {
  const data = await scrapeChapter(req.params.hid, req.params.chapter);
  return { status: data.error ? 404 : 200, body: data };
}

async function handleGenres() {
  const data = await scrapeGenres();
  return { status: data.error ? 500 : 200, body: data };
}

async function handleCollectionsPage() {
  const data = await scrapeCollectionsList();
  return { status: data.error ? 500 : 200, body: data };
}

async function handleCollectionDetail(req) {
  const data = await scrapeCollectionDetail(req.params.id);
  return { status: data.error ? 404 : 200, body: data };
}

async function handleProfile(req) {
  const data = await scrapeProfile(req.params.hashId);
  return { status: data.error ? 404 : 200, body: data };
}

async function handleComments(req) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const data = await getComments({ page, limit });
  return { status: data.error ? 502 : 200, body: data };
}

async function handleCollectionsApi(req) {
  const sort = req.query.sort || "trending";
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const data = await getCollections({ sort, page, limit });
  return { status: data.error ? 502 : 200, body: data };
}

const ROUTES = [
  ["GET", /^\/api\/?$/, handleHome, "GET /api — Home page data (trending, hot, latest, comments, collections, top uploaders)"],
  ["GET", /^\/api\/home\/?$/, handleHome, "GET /api/home — Same as /api"],
  ["GET", /^\/api\/genres\/?$/, handleGenres, "GET /api/genres — All genres and demographics"],
  ["GET", /^\/api\/collections\/?$/, handleCollectionsPage, "GET /api/collections — Collections listing (from HTML page)"],
  ["GET", /^\/api\/collections\/list\/?$/, handleCollectionsApi, "GET /api/collections/list?sort=trending&page=1&limit=20 — Collections via upstream API (paginated)"],
  ["GET", /^\/api\/collection\/([^/]+)\/?$/, handleCollectionDetail, "GET /api/collection/:id — Collection detail by id"],
  ["GET", /^\/api\/manga\/([^/]+)\/?$/, handleMangaDetail, "GET /api/manga/:hid — Manga detail, recommendations, groups (by hid or full-slug)"],
  ["GET", /^\/api\/chapter\/([^/]+)\/([^/]+)\/?$/, handleChapter, "GET /api/chapter/:hid/:chapterSlug — Chapter read metadata"],
  ["GET", /^\/api\/comments\/?$/, handleComments, "GET /api/comments?page=1&limit=20 — Recent comments via upstream API"],
  ["GET", /^\/api\/profile\/([^/]+)\/?$/, handleProfile, "GET /api/profile/:hashId — User profile by hashId"],
];

function parseUrl(req) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const query = Object.fromEntries(url.searchParams.entries());
  return { pathname: url.pathname, query };
}

function matchRouteV2(method, pathname) {
  for (const [m, pattern, handler, desc] of ROUTES) {
    if (m !== method) continue;
    const match = pathname.match(pattern);
    if (match) {
      const params = {};
      const groups = match.slice(1);
      if (desc.includes(":hid") && desc.includes(":chapterSlug")) {
        params.hid = decodeURIComponent(groups[0]);
        params.chapter = decodeURIComponent(groups[1]);
      } else if (desc.includes(":hid")) {
        params.hid = decodeURIComponent(groups[0]);
      } else if (desc.includes(":id")) {
        params.id = decodeURIComponent(groups[0]);
      } else if (desc.includes(":hashId")) {
        params.hashId = decodeURIComponent(groups[0]);
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
      name: "Comix.to Scraping API",
      version: "1.0.0",
      base: BASE,
      endpoints: ROUTES.map(([m, , , desc]) => desc),
      note: "All data is scraped from comix.to HTML pages or proxied from their public API. Chapter images require an anti-bot token and are not available.",
    });
    return;
  }
  const matched = matchRouteV2(req.method, pathname);
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
    console.log(`Comix API server running on http://localhost:${PORT}`);
    console.log(`Try: http://localhost:${PORT}/`);
  });
}
