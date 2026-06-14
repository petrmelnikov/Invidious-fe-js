import { api, assetUrl } from "../api.js";
import { errorState, list, loading } from "../components.js";
import { getConfig } from "../config.js";
import { compactNumber, escapeHtml, fullNumber, pickThumbnail, relativeTime, setTitle } from "../utils.js";

const view = () => document.getElementById("view");
const DASH_JS_URL = "https://cdn.jsdelivr.net/npm/dashjs@4.7.4/dist/dash.all.min.js";
let dashScriptPromise;
let dashPlayer;
let dashManifestUrl;

export async function renderWatch({ search }) {
  const id = search.get("v") || search.get("id");
  if (!id) {
    view().innerHTML = errorState(new Error("Missing video id"));
    return;
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
    view().innerHTML = errorState(new Error(`Invalid YouTube video id: ${id}`));
    return;
  }

  view().innerHTML = loading("Loading video");

  try {
    const video = await api.video(id);
    setTitle(video.title);
    view().innerHTML = watchMarkup(video);
    installWatchInteractions(video);
    loadComments(id);
  } catch (error) {
    view().innerHTML = errorState(error);
  }
}

function chooseStreams(video) {
  const streams = Array.isArray(video.formatStreams)
    ? video.formatStreams.filter((stream) => String(stream.itag) !== "17")
    : [];
  const sorted = streams.sort((a, b) => Number.parseInt(b.resolution || b.quality || 0, 10) - Number.parseInt(a.resolution || a.quality || 0, 10));
  const preferred = getConfig().quality;

  if (!preferred || preferred === "auto") return sorted;

  const match = sorted.find((stream) => [stream.qualityLabel, stream.resolution, stream.quality].some((value) => String(value || "").includes(preferred)));
  return match ? [match, ...sorted.filter((stream) => stream !== match)] : sorted;
}

function hasDashStreams(video) {
  const formats = Array.isArray(video.adaptiveFormats) ? video.adaptiveFormats : [];
  return formats.some((stream) => String(stream.type || "").startsWith("video/"))
    && formats.some((stream) => String(stream.type || "").startsWith("audio/"));
}

function dashQualityOptions(video) {
  const formats = Array.isArray(video.adaptiveFormats) ? video.adaptiveFormats : [];
  const seen = new Set();

  return formats
    .filter((stream) => String(stream.type || "").startsWith("video/mp4"))
    .filter((stream) => stream.qualityLabel || stream.resolution)
    .map((stream) => ({
      label: stream.qualityLabel || stream.resolution,
      height: Number.parseInt(stream.resolution || stream.qualityLabel || "0", 10),
      fps: Number.parseInt(String(stream.qualityLabel || "").replace(/^\d+p/, ""), 10) || Number(stream.fps || 0) || 30
    }))
    .filter((stream) => {
      const key = `${stream.height}:${stream.fps}`;
      if (!stream.height || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.height - a.height || b.fps - a.fps);
}

function watchMarkup(video) {
  const streams = chooseStreams(video);
  const selected = streams[0];
  const dashAvailable = hasDashStreams(video);
  const poster = assetUrl(pickThumbnail(video.videoThumbnails, 1280));
  const published = video.publishedText || relativeTime(video.published);
  const related = video.recommendedVideos || video.relatedVideos || [];

  return `
    <section class="watch-layout">
      <article class="watch-main">
        <div class="player-frame">
          ${dashAvailable || selected ? `
            <video id="video-player" controls playsinline preload="metadata" poster="${escapeHtml(poster)}">
              ${dashAvailable ? "" : sourceTags(video, streams).join("")}
              ${captionTracks(video).join("")}
            </video>
          ` : video.hlsUrl ? `
            <video id="video-player" controls playsinline preload="metadata" poster="${escapeHtml(poster)}">
              <source src="${escapeHtml(assetUrl(video.hlsUrl))}" type="application/x-mpegURL">
              ${captionTracks(video).join("")}
            </video>
          ` : `
            <img src="${escapeHtml(poster)}" alt="">
            <div class="player-message">No browser-playable stream was returned by the backend.</div>
          `}
        </div>

        ${dashAvailable || streams.length ? streamSelector(video, streams, selected, dashAvailable) : ""}
        <p class="player-note" id="player-note"></p>

        <header class="watch-header">
          <h1>${escapeHtml(video.title)}</h1>
          <p class="meta">
            ${video.viewCount ? `${escapeHtml(fullNumber(video.viewCount))} views` : ""}
            ${video.viewCount && published ? " · " : ""}
            ${published ? escapeHtml(published) : ""}
          </p>
        </header>

        <section class="author-strip">
          <a class="avatar" href="/channel/${encodeURIComponent(video.authorId || "")}" data-link>
            ${authorAvatar(video)}
          </a>
          <div>
            <h2><a href="/channel/${encodeURIComponent(video.authorId || "")}" data-link>${escapeHtml(video.author || "Channel")}</a></h2>
            <p class="meta">${escapeHtml(video.subCountText || "")}</p>
          </div>
          ${video.likeCount ? `<div class="like-pill">${escapeHtml(compactNumber(video.likeCount))} likes</div>` : ""}
        </section>

        ${video.descriptionHtml || video.description ? `
          <details class="description" open>
            <summary>Description</summary>
            <div>${video.descriptionHtml || escapeHtml(video.description).replaceAll("\n", "<br>")}</div>
          </details>
        ` : ""}

        <section class="comments" id="comments">${loading("Loading comments")}</section>
      </article>

      <aside class="watch-side">
        <h2>Related</h2>
        ${list(related, { compact: true })}
      </aside>
    </section>
  `;
}

function authorAvatar(video) {
  const thumb = assetUrl(pickThumbnail(video.authorThumbnails, 100));
  if (thumb) return `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">`;
  return escapeHtml((video.author || "I").slice(0, 1).toUpperCase());
}

function streamSelector(video, streams, selected, dashAvailable) {
  const dashOptions = dashAvailable ? dashQualityOptions(video) : [];

  return `
    <label class="quality-select">
      Quality
      <select id="stream-select" class="select">
        ${dashAvailable ? `<option value="${escapeHtml(api.dashManifest(video.videoId))}" data-mode="dash" selected>Auto DASH</option>` : ""}
        ${dashOptions.map((stream) => `
          <option value="${escapeHtml(api.dashManifest(video.videoId))}" data-mode="dash-fixed" data-height="${escapeHtml(stream.height)}" data-label="${escapeHtml(stream.label)}">
            ${escapeHtml(stream.label)} DASH
          </option>
        `).join("")}
        ${streams.map((stream) => `
          <option value="${escapeHtml(api.latestVersion(video.videoId, stream.itag))}" data-mode="progressive" data-type="${escapeHtml(stream.type || "")}" ${!dashAvailable && stream.itag === selected?.itag ? "selected" : ""}>
            ${escapeHtml(stream.qualityLabel || stream.resolution || stream.quality || stream.itag)} MP4
          </option>
        `).join("")}
      </select>
    </label>
  `;
}

function sourceTags(video, streams) {
  return streams.map((stream) => `
    <source src="${escapeHtml(api.latestVersion(video.videoId, stream.itag))}" type="${escapeHtml(stream.type || "")}" data-itag="${escapeHtml(stream.itag)}">
  `);
}

function captionTracks(video) {
  if (!Array.isArray(video.captions)) return [];
  return video.captions.map((caption, index) => {
    const label = caption.label || caption.language_code || caption.languageCode;
    const lang = caption.language_code || caption.languageCode || "";
    const src = caption.url ? assetUrl(caption.url) : api.captions(video.videoId, { label });
    return `<track kind="subtitles" src="${escapeHtml(src)}" srclang="${escapeHtml(lang)}" label="${escapeHtml(label)}" ${index === 0 ? "default" : ""}>`;
  });
}

function installWatchInteractions(video) {
  const player = document.getElementById("video-player");
  const selector = document.getElementById("stream-select");

  const selectedOption = selector?.selectedOptions[0];

  if (player && selectedOption && selectedOption.dataset.mode.startsWith("dash")) {
    initializeDash(player, selectedOption);
  }

  document.getElementById("stream-select")?.addEventListener("change", (event) => {
    if (!player) return;
    const currentTime = player.currentTime;
    const paused = player.paused;

    const option = event.target.selectedOptions[0];

    if (option?.dataset.mode?.startsWith("dash")) {
      initializeDash(player, option, currentTime, paused);
      return;
    }

    destroyDash();
    player.src = event.target.value;
    player.currentTime = currentTime;
    player.load();
    if (!paused) player.play().catch(() => {});
  });

  player?.addEventListener("error", () => {
    const sources = [...player.querySelectorAll("source")];
    const current = player.currentSrc || player.src;
    const next = sources.find((source) => source.src && source.src !== current && player.canPlayType(source.type) !== "");

    if (!next) return;

    const currentTime = player.currentTime || 0;
    player.src = next.src;
    player.currentTime = currentTime;
    player.load();
  }, { once: true });
}

function loadDashScript() {
  if (window.dashjs) return Promise.resolve(window.dashjs);
  if (dashScriptPromise) return dashScriptPromise;

  dashScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = DASH_JS_URL;
    script.async = true;
    script.onload = () => resolve(window.dashjs);
    script.onerror = () => reject(new Error("Could not load dash.js"));
    document.head.append(script);
  });

  return dashScriptPromise;
}

async function initializeDash(player, option, currentTime = 0, paused = true) {
  const note = document.getElementById("player-note");
  try {
    const dashjs = await loadDashScript();
    const manifest = option.value;
    const requestedQuality = {
      mode: option.dataset.mode,
      height: Number(option.dataset.height || 0),
      label: option.dataset.label || ""
    };

    if (!dashPlayer || dashManifestUrl !== manifest) {
      destroyDash();
      dashManifestUrl = manifest;
      dashPlayer = dashjs.MediaPlayer().create();
      dashPlayer.updateSettings({
        streaming: {
          abr: { autoSwitchBitrate: { audio: true, video: true } },
          buffer: { stableBufferTime: 30 }
        }
      });
      dashPlayer.initialize(player, manifest, !paused);
      dashPlayer.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
        if (currentTime > 0) player.currentTime = currentTime;
        applyDashQuality(requestedQuality);
      });
    } else {
      applyDashQuality(requestedQuality);
      if (!paused) player.play().catch(() => {});
    }

    if (note) {
      note.textContent = requestedQuality.mode === "dash-fixed"
        ? `DASH fixed at ${requestedQuality.label}.`
        : "DASH adaptive playback enabled.";
    }
  } catch (error) {
    if (note) note.textContent = `${error.message}. Falling back to progressive playback.`;
    document.querySelector("#stream-select option[data-mode='progressive']")?.setAttribute("selected", "selected");
    const fallback = document.querySelector("#stream-select option[data-mode='progressive']")?.value;
    if (fallback) {
      player.src = fallback;
      player.load();
    }
  }
}

function destroyDash() {
  if (!dashPlayer) return;
  dashPlayer.reset();
  dashPlayer = null;
  dashManifestUrl = "";
}

function applyDashQuality(requestedQuality) {
  if (!dashPlayer) return;

  const auto = requestedQuality.mode !== "dash-fixed";
  dashPlayer.updateSettings({
    streaming: {
      abr: { autoSwitchBitrate: { video: auto } }
    }
  });

  if (auto) return;

  const bitrates = dashPlayer.getBitrateInfoListFor("video") || [];
  const quality = bitrates
    .map((entry, index) => ({ ...entry, index }))
    .filter((entry) => Number(entry.height) === requestedQuality.height)
    .sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0];

  if (quality) {
    dashPlayer.setQualityFor("video", quality.qualityIndex ?? quality.index, true);
  }
}

async function loadComments(id) {
  const comments = document.getElementById("comments");
  if (!comments) return;

  try {
    const payload = await api.comments(id, getConfig().comments);
    const entries = payload.comments || [];
    comments.innerHTML = `
      <h2>Comments</h2>
      ${entries.length ? `<div class="comment-list">${entries.slice(0, 40).map(commentMarkup).join("")}</div>` : "<p class='meta'>No comments returned.</p>"}
    `;
  } catch (error) {
    comments.innerHTML = `<h2>Comments</h2><p class="meta">${escapeHtml(error.message || "Could not load comments")}</p>`;
  }
}

function commentMarkup(comment) {
  const author = comment.author || "User";
  const content = comment.contentHtml || escapeHtml(comment.content || "");
  return `
    <article class="comment">
      <div class="comment-header">
        <strong>${escapeHtml(author)}</strong>
        <span>${escapeHtml(comment.publishedText || "")}</span>
      </div>
      <div>${content}</div>
    </article>
  `;
}
