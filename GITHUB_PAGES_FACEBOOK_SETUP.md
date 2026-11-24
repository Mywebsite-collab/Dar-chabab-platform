# GitHub Pages + live Facebook news

The website frontend stays on GitHub Pages. GitHub Pages only serves static files, so the private Meta token and Graph API request run in a separate Cloudflare Worker. The website renders returned posts as native RTL cards in its existing dark/gold design.

## 1. Deploy the Worker

You need a Cloudflare account and a Meta Page access token for the official page `https://www.facebook.com/mjmesra`.

From the repository root, with Wrangler installed or available through npx:

```bash
npx wrangler login
npx wrangler secret put FB_PAGE_ACCESS_TOKEN --config workers/facebook-feed/wrangler.toml
npx wrangler deploy --config workers/facebook-feed/wrangler.toml
```

When prompted for the secret, paste the Page access token. Do not put it in a source file, GitHub commit, browser storage, or a public issue.

The Worker name is `mjm-facebook-feed`. After deployment, Wrangler prints its public URL, in this form:

`https://mjm-facebook-feed.<YOUR-CLOUDFLARE-SUBDOMAIN>.workers.dev`

The Worker configuration already restricts browser requests to the default GitHub Pages origin:

`https://mywebsite-collab.github.io`

If GitHub Pages is configured with a custom domain, change `ALLOWED_ORIGIN` in `workers/facebook-feed/wrangler.toml` to that domain's exact origin (scheme + hostname, no path), then deploy again.

## 2. Connect the website

Open `facebook-feed-config.js` and replace the empty string with the Worker URL printed by Wrangler:

```js
window.MJM_FACEBOOK_API_URL = "https://mjm-facebook-feed.<YOUR-CLOUDFLARE-SUBDOMAIN>.workers.dev";
```

Commit this public URL to the branch used by GitHub Pages. The URL is not a secret; the Meta Page access token remains stored only as a Cloudflare Worker Secret.

## 3. Check the connection

Open these URLs after deployment:

- `https://mjm-facebook-feed.<YOUR-CLOUDFLARE-SUBDOMAIN>.workers.dev/api/health` — should report `facebookConfigured: true`.
- `https://mjm-facebook-feed.<YOUR-CLOUDFLARE-SUBDOMAIN>.workers.dev/api/facebook-feed` — should return `ok: true` and a `posts` array.

Then reload the GitHub Pages website. The news section displays the newest returned posts as native cards: image on the right, publication date, text excerpt, and a link to the original Facebook post. The compact home widget shows the latest three; the full news widget can show up to twelve.

## 4. Meta access requirements

The token must be a Page access token that can read published posts for the official Page. Meta documents the `/{page-id}/published_posts` edge and notes that Page Public Content Access may be required. For Pages managed by the app user, Page permissions such as `pages_read_engagement` and `pages_read_user_content` may be required depending on the access flow.

Official references:
- https://developers.facebook.com/docs/graph-api/reference/page/published_posts/
- https://developers.facebook.com/docs/graph-api/reference/page/

## Security and behavior

- The token is read only by the Worker from `FB_PAGE_ACCESS_TOKEN`.
- CORS is restricted to the GitHub Pages origin by default.
- The Worker limits the requested post count and times out slow Meta API calls.
- Successful results are cached for five minutes to reduce calls to Meta.
- GitHub Pages cannot run the private API itself; the Worker is required for live Graph API access.
