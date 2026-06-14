import { applyTheme } from "./config.js";
import { installRouter, navigate, notFound, renderRoute, route } from "./router.js";
import { renderChannel } from "./views/channel.js";
import { renderFeed } from "./views/feed.js";
import { renderHome } from "./views/home.js";
import { renderPlaylist } from "./views/playlist.js";
import { renderSearch } from "./views/search.js";
import { renderSettings } from "./views/settings.js";
import { renderStaticPage } from "./views/static.js";
import { renderWatch } from "./views/watch.js";

applyTheme();

route("/", renderHome);
route("/feed/trending", (ctx) => renderFeed(ctx, "trending"));
route("/feed/popular", (ctx) => renderFeed(ctx, "popular"));
route("/search", renderSearch);
route("/watch", renderWatch);
route("/channel/:ucid", renderChannel);
route("/playlist", renderPlaylist);
route("/settings", renderSettings);
route("/privacy", (ctx) => renderStaticPage(ctx, "privacy"));
route("/licenses", (ctx) => renderStaticPage(ctx, "licenses"));
notFound(renderHome);

installRouter();

document.getElementById("global-search").addEventListener("submit", (event) => {
  event.preventDefault();
  const q = new FormData(event.currentTarget).get("q")?.toString().trim();
  if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
});

window.addEventListener("configchange", () => renderRoute());

renderRoute();
