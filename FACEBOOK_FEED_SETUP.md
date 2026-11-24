# Live Facebook Page Feed

The website now renders Facebook posts as native cards inside the site. It no longer embeds the Facebook Page iframe, scrapes Facebook HTML, or stores a Page token in the visitor's browser.

## Required hosting setup

This project now needs a Node.js host (Node 20+; Node 22 recommended) because static-only hosting cannot run the private API endpoint.

1. Deploy the repository as a Node.js web service.
2. Set the start command to `npm start`.
3. Add the following environment variables in the host dashboard:
   - `FB_PAGE_ACCESS_TOKEN`: a valid Page access token for the official `mjmesra` Page.
   - `FB_PAGE_NAME`: `دار الشباب ماسرى` (optional display name).
   - `FB_GRAPH_VERSION`: `v27.0` (optional).
4. Never commit the real token and never paste it into the website admin panel or browser storage.
5. Check `/api/health`; it should return `facebookConfigured: true`.
6. Check `/api/facebook-feed`; it should return the latest published posts.

## Meta permissions

For a Page you manage, the app/token needs the appropriate Page access and the `pages_read_engagement` permission; Meta may also require `pages_read_user_content` depending on the requested content and access flow. If the Page is not managed by the token owner, Meta requires approval for Page Public Content Access. The server uses the Page token only and never returns it to the browser.

## Behavior

- Uses Meta Graph API's `/me/published_posts` endpoint.
- Displays the newest posts first, including text, date, image (when supplied), and a link to the original post.
- Caches successful responses in server memory for five minutes by default.
- If Meta is temporarily unavailable, serves the last successful cached response when available.
- Returns a clear configuration error until the host environment variable is set.

## Local development

Copy `.env.example` values into your local shell environment (replace the placeholder with a real token kept private), then run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000/api/health` to verify server configuration.
