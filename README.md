# Invidious FE

Standalone frontend for an Invidious backend. It does not copy templates back into
the original Crystal project; it talks to the backend through `/api/v1/*`.

## Run

Start Invidious separately, usually on `http://localhost:3000`, then run:

```sh
npm run dev
```

Open `http://localhost:5173`.

The frontend backend URL is configurable in the Settings page. The default is
`http://localhost:3000`.

## Project Layout

- `src/api.js` - Invidious API client and URL helpers.
- `src/router.js` - client-side routing.
- `src/views/` - pages for home, search, watch, channel, playlist, and settings.
- `src/components.js` - shared cards, lists, loading and error states.
- `src/styles.css` - complete UI styling.
- `scripts/dev-server.mjs` - dependency-free static dev server with SPA fallback.

## Implemented Surface

- Search with filters through `/api/v1/search`.
- Trending and popular feeds.
- Watch page with proxied video streams via `/api/v1/videos/:id?local=true`.
- SponsorBlock integration on the watch player with per-category auto-skip or manual-skip behavior.
- Related videos, comments, captions, metadata, and channel links.
- Channel overview, latest videos, playlists, community, channels, and search.
- Public playlists.
- Backend origin, region, theme, and video quality preferences.

## SponsorBlock

SponsorBlock is integrated in the same style as Piped: the frontend fetches skip
segments from the official SponsorBlock API and applies them on top of the native
HTML5 video element. The integration is isolated in `src/sponsorblock.js` so it
can evolve independently from the rest of the player code.

The Settings page lets you:

- enable or disable SponsorBlock;
- choose the SponsorBlock API origin;
- toggle timeline markers;
- set the minimum segment length;
- configure each category as `auto`, `button`, or `no`.

There is no browser-ready SponsorBlock package with a stable player API that fits
this app better than the direct API approach. The available packages are either
Node-only wrappers or userscript bundles, so this frontend talks directly to the
official API instead of vendoring a third-party runtime.

Authenticated account features can be added later on top of the same API client.
