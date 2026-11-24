import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || "v27.0";
const PAGE_TOKEN = (process.env.FB_PAGE_ACCESS_TOKEN || "").trim();
const PAGE_NAME = process.env.FB_PAGE_NAME || "دار الشباب ماسرى";
const CACHE_TTL_MS = Math.max(60_000, Number(process.env.FB_CACHE_TTL_MS || 300_000));
const MAX_POSTS = 20;
let feedCache = { expiresAt: 0, payload: null };

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json"
};

function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

async function getFacebookFeed(limit) {
  if (!PAGE_TOKEN) {
    const error = new Error("إعدادات ربط فيسبوك غير مكتملة على الخادم. يجب ضبط FB_PAGE_ACCESS_TOKEN.");
    error.status = 503;
    error.code = "FACEBOOK_NOT_CONFIGURED";
    throw error;
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/published_posts`);
  url.searchParams.set("fields", "id,message,created_time,permalink_url,full_picture");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", PAGE_TOKEN);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000)
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.error) {
    const apiMessage = result?.error?.message || "تعذر جلب منشورات الصفحة من Meta Graph API.";
    const error = new Error(apiMessage);
    error.status = response.status === 429 ? 503 : 502;
    error.code = "FACEBOOK_GRAPH_API_ERROR";
    throw error;
  }

  const posts = (Array.isArray(result.data) ? result.data : [])
    .filter((post) => post && (post.message || post.full_picture))
    .map((post) => ({
      id: String(post.id || ""),
      message: String(post.message || ""),
      created_time: post.created_time || null,
      permalink_url: post.permalink_url || "https://www.facebook.com/mjmesra",
      full_picture: post.full_picture || ""
    }))
    .sort((a, b) => new Date(b.created_time || 0) - new Date(a.created_time || 0));

  const payload = {
    ok: true,
    pageName: PAGE_NAME,
    pageUrl: "https://www.facebook.com/mjmesra",
    syncedAt: new Date().toISOString(),
    posts
  };
  feedCache = { expiresAt: Date.now() + CACHE_TTL_MS, payload };
  return payload;
}

async function handleApi(req, res, pathname, url) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" }, { Allow: "GET" });
    return true;
  }

  if (pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      facebookConfigured: Boolean(PAGE_TOKEN),
      feedCacheAvailable: Boolean(feedCache.payload),
      feedCacheExpiresAt: feedCache.payload ? new Date(feedCache.expiresAt).toISOString() : null
    });
    return true;
  }

  if (pathname !== "/api/facebook-feed") return false;

  const requestedLimit = Number(url.searchParams.get("limit") || 8);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(MAX_POSTS, Math.floor(requestedLimit)))
    : 8;

  if (feedCache.payload && Date.now() < feedCache.expiresAt) {
    sendJson(res, 200, { ...feedCache.payload, cached: true }, {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=240"
    });
    return true;
  }

  try {
    const payload = await getFacebookFeed(limit);
    sendJson(res, 200, payload, {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=240"
    });
  } catch (error) {
    if (feedCache.payload) {
      sendJson(res, 200, {
        ...feedCache.payload,
        cached: true,
        stale: true,
        warning: "تعذر تحديث المنشورات الآن؛ نعرض آخر نسخة محفوظة."
      }, { "Cache-Control": "public, max-age=60" });
      return true;
    }
    sendJson(res, error.status || 502, {
      ok: false,
      code: error.code || "FEED_UNAVAILABLE",
      error: error.message || "Facebook feed unavailable",
      message: error.message || "Facebook feed unavailable"
    });
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  } catch {
    sendJson(res, 400, { ok: false, error: "BAD_REQUEST" });
    return;
  }

  if (await handleApi(req, res, url.pathname, url)) return;

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const target = path.resolve(ROOT, "." + requestedPath);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(target, (statError, stat) => {
    if (statError || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(target).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin"
    });
    fs.createReadStream(target).pipe(res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Masra Youth House server listening on port ${PORT}`);
  console.log(`Facebook feed: ${PAGE_TOKEN ? "configured" : "awaiting FB_PAGE_ACCESS_TOKEN"}`);
});
