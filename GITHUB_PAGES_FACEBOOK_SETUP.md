# Facebook Page timeline on GitHub Pages

The site displays the public timeline for the official Maison de Jeunes de Masra Facebook Page using Meta's official Page Plugin.

## No access token required

This setup does not use the Graph API, a Page access token, or the Cloudflare Worker. Do not create or publish an access token for this integration.

## Page used

`https://www.facebook.com/mjmesra`

The Page Plugin is embedded in the existing news section. It shows the Page's public timeline in Facebook's own interface and updates as Facebook makes new public posts available.

## Important limitations

- The Facebook Page must be public and must not have restrictions that prevent the plugin from loading.
- Facebook controls the appearance and behavior of the embedded timeline; it cannot be styled as individual native website cards.
- Some visitors may be asked to sign in to Facebook, and browser privacy settings or content blockers may prevent the plugin from appearing.
- The Page Plugin supports a width from 180 to 500 pixels. The site makes the iframe responsive within that limit.
- If the timeline does not load, use the button to open the official Page directly.

## Change the Page

The Page URL can be edited in the site's admin area under News → Facebook official Page URL. The iframe is rebuilt from that URL.

Official Meta documentation:
- https://developers.facebook.com/docs/plugins/page-plugin/
