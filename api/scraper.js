// Comix.to scraper — extracts embedded JSON data from the SPA's #initial-data script.
// All HTML pages on comix.to embed a <script type="application/json" id="initial-data">
// block containing the page's data as JSON. This module fetches a page and parses it.

const BASE = "https://comix.to";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export async function fetchPage(path) {
  const url = path.startsWith("http") ? path : BASE + path;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: BASE + "/",
    },
    redirect: "follow",
  });
  const html = await res.text();
  return { ok: res.ok, status: res.status, html };
}

export function extractInitialData(html) {
  const m = html.match(
    /<script type="application\/json" id="initial-data">([\s\S]*?)<\/script>/
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

export function pickQuery(data, needle) {
  if (!data || !data.queries) return null;
  for (const [k, v] of Object.entries(data.queries)) {
    if (k.includes(needle)) return v;
  }
  return null;
}

export async function scrapeHome() {
  const { html, status, ok } = await fetchPage("/");
  if (!ok) return { error: "Failed to fetch home page", status };
  const data = extractInitialData(html);
  if (!data) return { error: "Could not parse initial-data", status };
  const result = {};
  for (const [k, v] of Object.entries(data.queries || {})) {
    let label = "unknown";
    if (k.includes('"top"') && k.includes("trending")) label = "trending";
    else if (k.includes('"top"') && k.includes("follows")) label = "top_follows";
    else if (k.includes('"list"') && k.includes('"hot"')) label = "hot";
    else if (k.includes('"list"') && k.includes("created_at")) label = "latest";
    else if (k.includes('"comments"')) label = "recent_comments";
    else if (k.includes('"collections"')) label = "trending_collections";
    else if (k.includes('"topUploaders"')) label = "top_uploaders";
    result[label] = v;
  }
  return { page: "home", ...result };
}

export async function scrapeMangaDetail(hid) {
  if (!hid) return { error: "Missing manga hid (e.g. vy36n)" };
  let { html, status, ok } = await fetchPage(`/title/${hid}`);
  if (!ok || status === 404) {
    if (hid.includes("-")) {
      const r = await fetchPage(`/title/${hid}`);
      html = r.html;
      status = r.status;
      ok = r.ok;
    }
  }
  if (!ok) return { error: "Manga not found", status, hid };
  const data = extractInitialData(html);
  if (!data) return { error: "Could not parse initial-data", status };
  const detail = pickQuery(data, '"detail"');
  const recommended = pickQuery(data, '"recommended"');
  const groups = pickQuery(data, '"groups"');
  return { page: "manga", detail, recommended: recommended?.items ?? recommended ?? null, groups };
}

export async function scrapeChapter(mangaHid, chapterSlug) {
  if (!mangaHid || !chapterSlug) return { error: "Missing manga hid or chapter slug" };
  const path = `/title/${mangaHid}/${chapterSlug}`;
  const { html, status, ok } = await fetchPage(path);
  if (!ok) return { error: "Chapter not found", status, path };
  const data = extractInitialData(html);
  if (!data) return { error: "Could not parse initial-data", status };
  return { page: "read", read: data.read || null, manga: pickQuery(data, '"detail"'), note: "Chapter page images are loaded via a token-gated API at runtime and are not embedded in the HTML." };
}

export async function scrapeGenres() {
  const { html, status, ok } = await fetchPage("/genres");
  if (!ok) return { error: "Failed to fetch genres", status };
  const data = extractInitialData(html);
  if (!data) return { error: "Could not parse initial-data", status };
  return { page: "genres", genres: data.genres?.genres ?? [], demographics: data.genres?.demographics ?? [] };
}

export async function scrapeCollectionsList() {
  const { html, status, ok } = await fetchPage("/collections");
  if (!ok) return { error: "Failed to fetch collections page", status };
  const data = extractInitialData(html);
  if (!data) return { error: "Could not parse initial-data", status };
  const list = pickQuery(data, '"list"');
  return { page: "collections", items: list?.items ?? list ?? [] };
}

export async function scrapeCollectionDetail(id) {
  if (!id) return { error: "Missing collection id" };
  const { html, status, ok } = await fetchPage(`/collections/${id}`);
  if (!ok) return { error: "Collection not found", status, id };
  const data = extractInitialData(html);
  if (!data) return { error: "Could not parse initial-data", status };
  const detail = pickQuery(data, '"detail"');
  return { page: "collection", detail };
}

export async function scrapeProfile(hashId) {
  if (!hashId) return { error: "Missing user hashId" };
  const { html, status, ok } = await fetchPage(`/u/${hashId}`);
  if (!ok) return { error: "User not found", status, hashId };
  const data = extractInitialData(html);
  if (!data) return { error: "Could not parse initial-data", status };
  return { page: "profile", data: data.profile || data.user || null };
}

async function apiGet(path) {
  const url = BASE + path;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json", "X-Requested-With": "XMLHttpRequest", Referer: BASE + "/" },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { ok: res.ok, status: res.status, body };
}

export async function getComments({ page = 1, limit = 20 } = {}) {
  const { ok, status, body } = await apiGet(`/api/v1/comments?page=${page}&limit=${limit}`);
  if (!ok) return { error: "Upstream error", status, body };
  return { page: "comments", items: body.result || [], meta: body.meta || null };
}

export async function getCollections({ sort = "trending", page = 1, limit = 20 } = {}) {
  const { ok, status, body } = await apiGet(`/api/v1/collections?sort=${sort}&page=${page}&limit=${limit}`);
  if (!ok) return { error: "Upstream error", status, body };
  const r = body.result || {};
  return { page: "collections", items: r.items || [], meta: r.meta || null };
}

export { BASE };
