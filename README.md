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
- Related videos, comments, captions, metadata, and channel links.
- Channel overview, latest videos, playlists, community, channels, and search.
- Public playlists.
- Backend origin, region, theme, and video quality preferences.

Authenticated account features can be added later on top of the same API client.
