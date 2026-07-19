// AsuraScans.com scraper — zero-dependency HTML parser.
// asurascans.com is an Astro SSR site. All manga data is in server-rendered HTML.
// Chapter images are plain <img> tags pointing at cdn.asurascans.com.

const BASE = "https://asurascans.com";
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

function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

function extractAllMatches(html, regex) {
  const matches = [];
  let m;
  while ((m = regex.exec(html)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

export async function scrapeHome() {
  const { html, status, ok } = await fetchPage("/");
  if (!ok) return { error: "Failed to fetch home page", status };

  const trending = extractAllMatches(
    html,
    /<a[^>]*href="\/comics\/([^"]+)"[^>]*class="embla-trending__slide[^"]*">[\s\S]*?<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"/g
  ).map(([id, image, title]) => ({ id, image, title: decodeEntities(title) }));

  const featured = extractAllMatches(
    html,
    /<a[^>]*href="\/comics\/([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/g
  ).map(([id, title]) => ({ id, title: decodeEntities(title.trim()) }));

  return {
    page: "home",
    trending: trending.slice(0, 20),
    featured: dedupeById(featured).slice(0, 20),
  };
}

function dedupeById(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

export async function scrapeBrowse({ page = 1, name, genres, status, type, sort } = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", String(page));
  if (name) params.set("name", name);
  if (genres) params.set("genres", genres);
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  if (sort) params.set("sort", sort);
  const qs = params.toString();
  const path = `/browse${qs ? "?" + qs : ""}`;

  const { html, status: httpStatus, ok } = await fetchPage(path);
  if (!ok) return { error: "Failed to fetch browse page", status: httpStatus };

  const cardRegex =
    /<div class="series-card group[^"]*">[\s\S]*?<a[^>]*href="\/comics\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>[\s\S]*?<span class="text-\[10px\] font-semibold text-white">([^<]*)<\/span>[\s\S]*?<h3[^>]*>([^<]*)<\/h3>[\s\S]*?<span[^>]*>([^<]*)Chapters[\s\S]*?<span[^>]*class="[^"]*capitalize[^"]*"[^>]*>\s*([^<]*)\s*<\/span>/g;

  const results = extractAllMatches(html, cardRegex).map(
    ([id, image, title, rating, titleClean, chapters, statusText]) => ({
      id,
      title: decodeEntities(title.trim()),
      image,
      rating: rating.trim(),
      chapters: chapters.trim(),
      status: statusText.trim(),
    })
  );

  const hasNextPage = html.includes(`href="/browse?page=${page + 1}"`);

  return {
    page: "browse",
    currentPage: page,
    hasNextPage,
    results: dedupeById(results),
  };
}

export async function scrapeSearch(query, page = 1) {
  return scrapeBrowse({ page, name: query });
}

export async function scrapeMangaDetail(slug) {
  if (!slug) return { error: "Missing manga slug" };
  const { html, status, ok } = await fetchPage(`/comics/${slug}`);
  if (!ok) return { error: "Manga not found", status, slug };

  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : "";

  const imageMatch = html.match(
    /<img[^>]*src="(https:\/\/cdn\.asurascans\.com\/asura-images\/covers\/[^"]*)"[^>]/
  );
  const image = imageMatch ? imageMatch[1] : null;

  const ratingMatch = html.match(
    /data-series-rating[^>]*>\s*([\d.]+)\s*<\/span>/
  );
  const rating = ratingMatch ? ratingMatch[1].trim() : null;

  const statusMatch = html.match(
    /Status<\/div>[\s\S]*?capitalize[^>]*>\s*(\w+)\s*<\/span>/
  );
  const status = statusMatch ? statusMatch[1].trim() : null;

  const typeMatch = html.match(
    /Type<\/div>[\s\S]*?uppercase[^>]*>\s*(\w+)\s*<\/span>/
  );
  const type = typeMatch ? typeMatch[1].trim() : null;

  const artistMatch = html.match(
    /Artist<\/span>[\s\S]*?>([^<]+)<\/a>/
  );
  const artist = artistMatch ? artistMatch[1].trim() : null;

  const genres = extractAllMatches(
    html,
    /<a[^>]*href="\/browse\?genres=([^"]+)"[^>]*>\s*([^<]+)\s*<\/a>/g
  ).map(([slug, name]) => ({ slug, name: name.trim() }));

  const descMatch =
    html.match(/<meta name="description" content="([^"]*)">/);
  const description = descMatch ? decodeEntities(descMatch[1]) : "";

  const chapters = extractAllMatches(
    html,
    /<a[^>]*href="\/comics\/[^"]*\/chapter\/(\d+)"[^>]*data-astro-prefetch[^>]*>[\s\S]*?text-white[^>]*>\s*Chapter\s*(?:<!--\s*-->)?\s*([^<]+)\s*<\/span>[\s\S]*?text-white\/40">([^<]*)<\/span>/g
  ).map(([num, title, date]) => ({
    number: num.trim(),
    title: `Chapter ${num.trim()}`,
    releaseDate: date.trim(),
  }));

  return {
    page: "manga",
    slug,
    title,
    image,
    rating,
    status,
    type,
    artist,
    genres,
    description,
    chapters,
  };
}

export async function scrapeChapter(slug, chapterNumber) {
  if (!slug || !chapterNumber)
    return { error: "Missing manga slug or chapter number" };
  const path = `/comics/${slug}/chapter/${chapterNumber}`;
  const { html, status, ok } = await fetchPage(path);
  if (!ok) return { error: "Chapter not found", status, path };

  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(" - Read Online | Asura Scans", "").trim() : "";

  const images = extractAllMatches(
    html,
    /<img[^>]*src="(https:\/\/cdn\.asurascans\.com\/asura-images\/chapters\/[^"]*)"[^>]*>/g
  );

  return {
    page: "chapter",
    slug,
    chapter: chapterNumber,
    title,
    images,
    imageCount: images.length,
  };
}

export async function scrapeSeriesRanking() {
  const { html, status, ok } = await fetchPage("/series-ranking");
  if (!ok) return { error: "Failed to fetch series ranking", status };

  const results = extractAllMatches(
    html,
    /<a[^>]*href="\/comics\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"/g
  ).map(([id, image, title]) => ({
    id,
    image,
    title: decodeEntities(title),
  }));

  return {
    page: "series-ranking",
    results: dedupeById(results),
  };
}

export { BASE };
