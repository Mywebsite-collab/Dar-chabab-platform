# GitHub Pages + live Facebook news

The website frontend stays on GitHub Pages. GitHub Pages only serves static files, so the private Meta token and Graph API request must live in a separate serverless endpoint. This project uses a Cloudflare Worker for that endpoint.

## 1. Deploy the Worker

1. Open the Cloudflare dashboard and create a Worker named `mjm-facebook-feed`.
2. Deploy the code from `workers/facebook-feed/index.js` (or use Wrangler with `workers/facebook-feed/wrangler.toml`).
3. In Worker Settings → Variables and Secrets, add:
   - Secret: `FB_PAGE_ACCESS_TOKEN` — a valid token for the official page.
   - Variable: `FB_PAGE_NAME` — `دار الشباب ماسرى`.
   - Variable: `FB_GRAPH_VERSION` — `v27.0`.
   - Variable: `ALLOWED_ORIGIN` — optionally restrict this to your exact GitHub Pages origin, e.g. `https://YOUR-USERNAME.github.io`.
4. Do not put the token in GitHub files or browser code.
5. Test `https://YOUR-WORKER.workers.dev/api/health`. It should return `facebookConfigured: true`.
6. Test `https://YOUR-WORKER.workers.dev/api/facebook-feed`. It should return `ok: true` and a `posts` array.

## 2. Connect GitHub Pages

1. Open `facebook-feed-config.js`.
2. Set `window.MJM_FACEBOOK_API_URL` to your Worker base URL, without a trailing slash.
3. Commit the URL change to the GitHub Pages publishing branch.
4. Reload the published site. The news widget renders the returned posts as the site's own RTL cards (thumbnail, date, text, and original-post link), not as an embedded Facebook timeline.

## 3. Meta permissions

The Meta app/token must have the access needed for the Page's published posts. For a Page you manage, Meta documents `pages_read_engagement` and `pages_read_user_content` permissions; for a Page you do not manage, Page Public Content Access may be required. See:
- https://developers.facebook.com/docs/graph-api/reference/page/published_posts/
- https://developers.facebook.com/docs/graph-api/reference/page/feed/

## Notes

- The Worker caches a successful response for five minutes to reduce API calls.
- The browser never receives the Page access token.
- GitHub Pages cannot execute `server.mjs`; the Cloudflare Worker is the separate API service.
- The page's existing news card design is retained. The compact homepage cards show the newest posts first.
