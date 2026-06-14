import { api, assetUrl } from "../api.js";
import { channelCard, errorState, grid, list, loading, tabs } from "../components.js";
import { escapeHtml, fullNumber, pickThumbnail, setTitle } from "../utils.js";

const view = () => document.getElementById("view");

const channelTabs = (ucid) => [
  { key: "home", label: "Home", href: `/channel/${ucid}` },
  { key: "latest", label: "Latest", href: `/channel/${ucid}?tab=latest` },
  { key: "videos", label: "Videos", href: `/channel/${ucid}?tab=videos` },
  { key: "streams", label: "Streams", href: `/channel/${ucid}?tab=streams` },
  { key: "shorts", label: "Shorts", href: `/channel/${ucid}?tab=shorts` },
  { key: "playlists", label: "Playlists", href: `/channel/${ucid}?tab=playlists` },
  { key: "community", label: "Community", href: `/channel/${ucid}?tab=community` },
  { key: "channels", label: "Channels", href: `/channel/${ucid}?tab=channels` }
];

export async function renderChannel({ params, search }) {
  const ucid = params.ucid;
  const tab = search.get("tab") || "home";
  const q = search.get("q") || "";
  view().innerHTML = loading("Loading channel");

  try {
    const channel = await api.channel(ucid);
    setTitle(channel.author || channel.title || "Channel");
    const content = tab === "home" ? channelHome(channel) : await channelTab(ucid, tab, q);

    view().innerHTML = `
      ${channelHeader(channel)}
      ${tabs(channelTabs(ucid), tab)}
      ${tab === "videos" ? channelSearchForm(ucid, q) : ""}
      ${content}
    `;
  } catch (error) {
    view().innerHTML = errorState(error);
  }
}

function channelHeader(channel) {
  const banner = assetUrl(channel.authorBanners?.at?.(-1)?.url || channel.bannerUrl);
  const avatar = assetUrl(pickThumbnail(channel.authorThumbnails, 176));
  return `
    <section class="channel-hero">
      ${banner ? `<img class="channel-banner" src="${escapeHtml(banner)}" alt="" loading="lazy">` : ""}
      <div class="channel-profile">
        <div class="avatar avatar-large">${avatar ? `<img src="${escapeHtml(avatar)}" alt="">` : escapeHtml((channel.author || "C").slice(0, 1))}</div>
        <div>
          <h1>${escapeHtml(channel.author || channel.title || "Channel")}</h1>
          <p class="meta">
            ${channel.subCount ? `${escapeHtml(fullNumber(channel.subCount))} subscribers` : channel.subCountText ? escapeHtml(channel.subCountText) : ""}
            ${channel.totalViews ? ` · ${escapeHtml(fullNumber(channel.totalViews))} views` : ""}
          </p>
          ${channel.description ? `<p class="line-clamp">${escapeHtml(channel.description)}</p>` : ""}
        </div>
      </div>
    </section>
  `;
}

function channelHome(channel) {
  const latest = channel.latestVideos || channel.videos || [];
  const related = channel.relatedChannels || [];
  return `
    <section class="section">
      <div class="section-heading"><h2>Latest videos</h2></div>
      ${grid(latest)}
    </section>
    ${related.length ? `
      <section class="section">
        <div class="section-heading"><h2>Related channels</h2></div>
        <section class="list">${related.map(channelCard).join("")}</section>
      </section>
    ` : ""}
  `;
}

async function channelTab(ucid, tab, q) {
  const allowed = new Set(["latest", "videos", "shorts", "streams", "podcasts", "releases", "courses", "playlists", "community", "channels"]);
  if (tab === "videos" && q) {
    const results = await api.channelSearch(ucid, q);
    return list(results);
  }
  if (!allowed.has(tab)) return channelHome(await api.channel(ucid));
  const payload = await api.channelTab(ucid, tab);
  const items = payload.videos || payload.playlists || payload.channels || payload.posts || payload.contents || payload;
  if (tab === "community") return communityList(items);
  return tab === "channels" ? `<section class="list">${items.map(channelCard).join("")}</section>` : grid(Array.isArray(items) ? items : []);
}

function channelSearchForm(ucid, q) {
  return `
    <form class="filter-row" data-channel-search>
      <input type="search" name="q" value="${escapeHtml(q)}" placeholder="Search this channel">
      <button class="button" type="submit">Search</button>
      ${q ? `<a class="button button-ghost" href="/channel/${encodeURIComponent(ucid)}?tab=videos" data-link>Clear</a>` : ""}
    </form>
  `;
}

function communityList(items = []) {
  if (!Array.isArray(items) || !items.length) return "<section class='state'><p>No posts returned.</p></section>";
  return `
    <section class="post-list">
      ${items.map((post) => `
        <article class="post-card">
          <p class="meta">${escapeHtml(post.publishedText || "")}</p>
          <div>${post.contentHtml || escapeHtml(post.content || post.title || "")}</div>
        </article>
      `).join("")}
    </section>
  `;
}

document.addEventListener("submit", (event) => {
  if (!event.target.matches("[data-channel-search]")) return;
  event.preventDefault();
  const q = new FormData(event.target).get("q")?.toString().trim();
  const channelPath = window.location.pathname;
  window.history.pushState({}, "", q ? `${channelPath}?tab=videos&q=${encodeURIComponent(q)}` : `${channelPath}?tab=videos`);
  renderChannel({ params: { ucid: channelPath.split("/").pop() }, search: new URLSearchParams(window.location.search) });
});
