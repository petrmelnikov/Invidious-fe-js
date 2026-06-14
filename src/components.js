import { assetUrl } from "./api.js";
import { compactNumber, escapeHtml, fullNumber, pickThumbnail, relativeTime, secondsToDuration } from "./utils.js";

export function loading(label = "Loading") {
  return `<section class="state"><div class="spinner" aria-hidden="true"></div><p>${escapeHtml(label)}</p></section>`;
}

export function emptyState(title, text = "") {
  return `<section class="state"><h1>${escapeHtml(title)}</h1>${text ? `<p>${escapeHtml(text)}</p>` : ""}</section>`;
}

export function errorState(error, retryLabel = "Try again") {
  const message = error?.message || "Something went wrong";
  return `
    <section class="state state-error">
      <h1>Could not load this page</h1>
      <p>${escapeHtml(message)}</p>
      <button class="button" data-action="retry">${escapeHtml(retryLabel)}</button>
    </section>
  `;
}

export function pageHeader(title, subtitle = "", actions = "") {
  return `
    <section class="page-header">
      <div>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ""}
    </section>
  `;
}

export function videoCard(item, options = {}) {
  const id = item.videoId || item.id;
  const title = item.title || "Untitled video";
  const authorId = item.authorId || item.ucid;
  const author = item.author || item.authorName || "";
  const thumb = assetUrl(pickThumbnail(item.videoThumbnails || item.thumbnails));
  const length = secondsToDuration(item.lengthSeconds || item.length_seconds);
  const views = compactNumber(item.viewCount || item.views);
  const published = item.publishedText || relativeTime(item.published);
  const href = id ? `/watch?v=${encodeURIComponent(id)}` : "#";
  const compact = options.compact ? " video-card-compact" : "";

  return `
    <article class="video-card${compact}">
      <a class="thumb" href="${href}" data-link aria-label="${escapeHtml(title)}">
        ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">` : `<span class="thumb-fallback">No thumbnail</span>`}
        ${length ? `<span class="duration">${escapeHtml(length)}</span>` : ""}
        ${item.liveNow ? `<span class="live-badge">Live</span>` : ""}
      </a>
      <div class="video-info">
        <h2><a href="${href}" data-link>${escapeHtml(title)}</a></h2>
        ${author ? `<a class="muted-link" href="/channel/${encodeURIComponent(authorId || "")}" data-link>${escapeHtml(author)}</a>` : ""}
        <p class="meta">
          ${views ? `${escapeHtml(views)} views` : ""}
          ${views && published ? " · " : ""}
          ${published ? escapeHtml(published) : ""}
        </p>
      </div>
    </article>
  `;
}

export function channelCard(item) {
  const ucid = item.authorId || item.ucid || item.channelId;
  const name = item.author || item.authorName || item.title || "Channel";
  const thumb = assetUrl(pickThumbnail(item.authorThumbnails || item.channelThumbnails || item.thumbnails, 176));
  const subs = item.subCount || item.subscriberCount;
  const videos = item.videoCount;

  return `
    <article class="channel-card">
      <a class="avatar" href="/channel/${encodeURIComponent(ucid || "")}" data-link>
        ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">` : escapeHtml(name.slice(0, 1).toUpperCase())}
      </a>
      <div>
        <h2><a href="/channel/${encodeURIComponent(ucid || "")}" data-link>${escapeHtml(name)}</a></h2>
        <p class="meta">
          ${subs ? `${escapeHtml(compactNumber(subs))} subscribers` : item.subCountText ? escapeHtml(item.subCountText) : ""}
          ${videos ? ` · ${escapeHtml(fullNumber(videos))} videos` : ""}
        </p>
        ${item.description ? `<p class="line-clamp">${escapeHtml(item.description)}</p>` : ""}
      </div>
    </article>
  `;
}

export function playlistCard(item) {
  const id = item.playlistId || item.plid || item.id;
  const title = item.title || "Playlist";
  const author = item.author || item.authorName || "";
  const thumb = assetUrl(pickThumbnail(item.playlistThumbnail ? [{ url: item.playlistThumbnail }] : item.videoThumbnails || item.thumbnails));
  const count = item.videoCount || item.length;

  return `
    <article class="video-card">
      <a class="thumb" href="/playlist?list=${encodeURIComponent(id || "")}" data-link>
        ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">` : `<span class="thumb-fallback">Playlist</span>`}
        ${count ? `<span class="duration">${escapeHtml(String(count))} videos</span>` : ""}
      </a>
      <div class="video-info">
        <h2><a href="/playlist?list=${encodeURIComponent(id || "")}" data-link>${escapeHtml(title)}</a></h2>
        ${author ? `<p class="meta">${escapeHtml(author)}</p>` : ""}
      </div>
    </article>
  `;
}

export function itemCard(item, options = {}) {
  if (item.type === "channel" || item.authorId?.startsWith?.("UC") && !item.videoId && !item.playlistId) return channelCard(item);
  if (item.type === "playlist" || item.playlistId || item.plid) return playlistCard(item);
  return videoCard(item, options);
}

export function grid(items = [], options = {}) {
  if (!items.length) return emptyState("Nothing here yet");
  return `<section class="grid">${items.map((item) => itemCard(item, options)).join("")}</section>`;
}

export function list(items = [], options = {}) {
  if (!items.length) return emptyState("Nothing here yet");
  return `<section class="list">${items.map((item) => itemCard(item, { ...options, compact: true })).join("")}</section>`;
}

export function tabs(tabsConfig, active) {
  return `
    <nav class="tabs" aria-label="Channel sections">
      ${tabsConfig.map((tab) => `
        <a href="${tab.href}" data-link class="${tab.key === active ? "active" : ""}">${escapeHtml(tab.label)}</a>
      `).join("")}
    </nav>
  `;
}
