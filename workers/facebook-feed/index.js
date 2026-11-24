const PAGE_URL = "https://www.facebook.com/mjmesra";
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 20;
const CACHE_TTL = 300;

function json(data, status = 200, origin = "*", extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type",
      "x-content-type-options": "nosniff",
      ...extra
    }
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "*";
  const allowed = String(env.ALLOWED_ORIGIN || "*").split(",").map((v) => v.trim());
  return allowed.includes("*") || allowed.includes(origin) ? origin : "";
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);

    if (request.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "Content-Type",
          "access-control-max-age": "86400",
          "vary": "Origin",
          "x-content-type-options": "nosniff"
        }
      });
    }

    if (!origin) return json({ ok: false, error: "ORIGIN_NOT_ALLOWED" }, 403, "null");
    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        facebookConfigured: Boolean(env.FB_PAGE_ACCESS_TOKEN),
        page: PAGE_URL
      }, 200, origin);
    }
    if (url.pathname !== "/api/facebook-feed") {
      return json({ ok: false, error: "NOT_FOUND" }, 404, origin);
    }
    if (request.method !== "GET") {
      return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405, origin, { Allow: "GET, OPTIONS" });
    }
    if (!env.FB_PAGE_ACCESS_TOKEN) {
      return json({
        ok: false,
        code: "FACEBOOK_NOT_CONFIGURED",
        message: "خدمة أخبار فيسبوك لم تُضبط بعد على الخادم."
      }, 503, origin);
    }

    const requested = Number(url.searchParams.get("limit") || DEFAULT_LIMIT);
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(requested))) : DEFAULT_LIMIT;
    const cache = caches.default;
    const cacheUrl = new URL(request.url);
    cacheUrl.searchParams.set("limit", String(limit));
    const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("access-control-allow-origin", origin);
      headers.set("cache-control", "public, max-age=60");
      headers.set("vary", "Origin");
      return new Response(cached.body, { status: cached.status, headers });
    }

    try {
      const version = String(env.FB_GRAPH_VERSION || "v27.0");
      const edge = env.FB_PAGE_ID
        ? `https://graph.facebook.com/${version}/${encodeURIComponent(env.FB_PAGE_ID)}/published_posts`
        : `https://graph.facebook.com/${version}/me/published_posts`;
      const graphUrl = new URL(edge);
      graphUrl.searchParams.set("fields", "id,message,created_time,permalink_url,full_picture");
      graphUrl.searchParams.set("limit", String(limit));
      graphUrl.searchParams.set("access_token", env.FB_PAGE_ACCESS_TOKEN);

      const graphResponse = await fetch(graphUrl.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12_000)
      });
      const graphData = await graphResponse.json().catch(() => ({}));
      if (!graphResponse.ok || graphData.error) {
        return json({
          ok: false,
          code: "FACEBOOK_GRAPH_API_ERROR",
          message: graphData?.error?.message || "تعذر جلب منشورات الصفحة من فيسبوك."
        }, 502, origin);
      }

      const posts = (Array.isArray(graphData.data) ? graphData.data : [])
        .filter((post) => post && (post.message || post.full_picture))
        .map((post) => ({
          id: String(post.id || ""),
          message: String(post.message || ""),
          created_time: post.created_time || null,
          permalink_url: post.permalink_url || PAGE_URL,
          full_picture: post.full_picture || ""
        }))
        .sort((a, b) => new Date(b.created_time || 0) - new Date(a.created_time || 0));

      const payload = {
        ok: true,
        pageName: env.FB_PAGE_NAME || "دار الشباب ماسرى",
        pageUrl: PAGE_URL,
        syncedAt: new Date().toISOString(),
        posts
      };
      const response = json(payload, 200, origin, {
        "cache-control": `public, max-age=${CACHE_TTL}`,
        "vary": "Origin",
        "x-content-type-options": "nosniff"
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      return json({
        ok: false,
        code: "FEED_FETCH_FAILED",
        message: "تعذر الاتصال بخدمة فيسبوك حاليًا."
      }, 502, origin);
    }
  }
};
