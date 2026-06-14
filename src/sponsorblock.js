import { defaults, getConfig, normalizeOrigin } from "./config.js";

export const sponsorBlockCategoryOptions = [
  { id: "sponsor", label: "Sponsor", defaultMode: "auto", color: "#35c26b" },
  { id: "selfpromo", label: "Self-promo", defaultMode: "auto", color: "#4f8cff" },
  { id: "interaction", label: "Interaction", defaultMode: "button", color: "#f2b640" },
  { id: "intro", label: "Intro", defaultMode: "button", color: "#8f75ff" },
  { id: "outro", label: "Outro", defaultMode: "button", color: "#ff7b72" },
  { id: "preview", label: "Preview", defaultMode: "button", color: "#4cc9c0" },
  { id: "hook", label: "Hook", defaultMode: "no", color: "#ff9f43" },
  { id: "filler", label: "Filler", defaultMode: "no", color: "#8892a0" }
];

const VALID_MODES = new Set(["no", "button", "auto"]);
const ACTIVE_SEGMENT_EPSILON = 0.05;

export function getSponsorBlockSettings(config = getConfig()) {
  const saved = config.sponsorBlock || {};

  return {
    enabled: Boolean(saved.enabled),
    apiOrigin: normalizeOrigin(saved.apiOrigin || defaults.sponsorBlock.apiOrigin),
    showMarkers: saved.showMarkers !== false,
    minSegmentLength: normalizeMinLength(saved.minSegmentLength),
    categories: Object.fromEntries(sponsorBlockCategoryOptions.map((option) => [
      option.id,
      VALID_MODES.has(saved.categories?.[option.id]) ? saved.categories[option.id] : option.defaultMode
    ]))
  };
}

export function installSponsorBlock({ player, videoId, noteElement, markerElement, skipButton }) {
  setNote(noteElement, "");
  renderTimelineMarkers(markerElement, [], 0, false);
  updateSkipButton(skipButton, null);

  if (!player || !videoId) return () => {};

  const settings = getSponsorBlockSettings();
  const categoryModes = settings.categories;
  const requestedCategories = sponsorBlockCategoryOptions
    .map((option) => option.id)
    .filter((category) => categoryModes[category] !== "no");

  if (!settings.enabled || !requestedCategories.length) return () => {};

  let destroyed = false;
  let segments = [];
  let animationFrame = 0;

  const handlePlaybackState = () => {
    if (destroyed || !player.isConnected) return;

    const currentTime = Number(player.currentTime || 0);
    updateTimelineProgress(markerElement, currentTime, Number(player.duration || 0));
    clearSkipGuards(segments, currentTime);

    const segment = findCurrentSegment(segments, currentTime, (entry) => !entry.autoSkip);
    updateSkipButton(skipButton, segment);

    skipCurrentAutoSegment(currentTime);
  };

  const skipCurrentSegment = () => {
    if (destroyed || !player.isConnected) return;
    const segment = findCurrentSegment(segments, Number(player.currentTime || 0), (entry) => !entry.autoSkip);

    if (!segment) return;

    skipSegments(player, noteElement, [segment], segment.end);
    updateSkipButton(skipButton, null);
  };

  const skipCurrentAutoSegment = (currentTime) => {
    const segment = findCurrentSegment(segments, currentTime, (entry) => entry.autoSkip && !entry.skipped);
    if (!segment) return false;

    const skippedSegments = contiguousAutoSegments(segments, segment);
    skipSegments(player, noteElement, skippedSegments, skippedSegments[skippedSegments.length - 1].end);
    return true;
  };

  const startPlaybackLoop = () => {
    if (animationFrame || destroyed) return;

    const tick = () => {
      animationFrame = 0;
      handlePlaybackState();

      if (!destroyed && player.isConnected && !player.paused && !player.ended) {
        animationFrame = requestAnimationFrame(tick);
      }
    };

    animationFrame = requestAnimationFrame(tick);
  };

  const stopPlaybackLoop = () => {
    if (!animationFrame) return;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  };

  const refreshMarkers = () => {
    if (destroyed || !player.isConnected) return;
    renderTimelineMarkers(markerElement, segments, Number(player.duration || 0), settings.showMarkers);
    updateTimelineProgress(markerElement, Number(player.currentTime || 0), Number(player.duration || 0));
  };

  const seekFromTimeline = (event) => {
    if (destroyed || !player.isConnected || !markerElement || markerElement.hidden) return;

    const duration = Number(player.duration || 0);
    if (!Number.isFinite(duration) || duration <= 0) return;

    const rect = markerElement.getBoundingClientRect();
    if (!rect.width) return;

    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    player.currentTime = ratio * duration;
    handlePlaybackState();
  };

  player.addEventListener("timeupdate", handlePlaybackState);
  player.addEventListener("playing", startPlaybackLoop);
  player.addEventListener("pause", stopPlaybackLoop);
  player.addEventListener("ended", stopPlaybackLoop);
  player.addEventListener("seeked", handlePlaybackState);
  player.addEventListener("loadedmetadata", refreshMarkers);
  player.addEventListener("durationchange", refreshMarkers);
  markerElement?.addEventListener("click", seekFromTimeline);
  skipButton?.addEventListener("click", skipCurrentSegment);

  void loadSponsorSegments(videoId, settings, requestedCategories)
    .then((loadedSegments) => {
      if (destroyed || !player.isConnected) return;

      segments = loadedSegments;
      refreshMarkers();
      handlePlaybackState();
      startPlaybackLoop();

      if (!segments.length) return;

      const autoCount = segments.filter((segment) => segment.autoSkip).length;
      const manualCount = segments.length - autoCount;
      const suffix = [
        autoCount ? `${autoCount} auto` : "",
        manualCount ? `${manualCount} manual` : ""
      ].filter(Boolean).join(", ");

      setNote(noteElement, `SponsorBlock loaded ${segments.length} segment${segments.length === 1 ? "" : "s"}${suffix ? ` (${suffix}).` : "."}`);
    })
    .catch((error) => {
      if (destroyed || !player.isConnected) return;
      setNote(noteElement, `SponsorBlock unavailable: ${error.message}.`);
    });

  return () => {
    destroyed = true;
    stopPlaybackLoop();
    renderTimelineMarkers(markerElement, [], 0, false);
    player.removeEventListener("timeupdate", handlePlaybackState);
    player.removeEventListener("playing", startPlaybackLoop);
    player.removeEventListener("pause", stopPlaybackLoop);
    player.removeEventListener("ended", stopPlaybackLoop);
    player.removeEventListener("seeked", handlePlaybackState);
    player.removeEventListener("loadedmetadata", refreshMarkers);
    player.removeEventListener("durationchange", refreshMarkers);
    markerElement?.removeEventListener("click", seekFromTimeline);
    skipButton?.removeEventListener("click", skipCurrentSegment);
  };
}

async function loadSponsorSegments(videoId, settings, categories) {
  const url = new URL("/api/skipSegments", `${settings.apiOrigin || defaults.sponsorBlock.apiOrigin}/`);
  url.searchParams.set("videoID", videoId);
  url.searchParams.set("categories", JSON.stringify(categories));
  url.searchParams.set("actionTypes", JSON.stringify(["skip"]));
  url.searchParams.set("service", "YouTube");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" }
  });

  if (response.status === 404) return [];

  const payload = await readPayload(response);
  if (!response.ok) {
    const message = typeof payload === "string"
      ? payload
      : payload?.message || payload?.error || "Could not load SponsorBlock segments";
    throw new Error(message);
  }

  return normalizeSegments(Array.isArray(payload) ? payload : [], settings.categories, settings.minSegmentLength);
}

async function readPayload(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  return response.text();
}

function normalizeSegments(payload, categoryModes, minSegmentLength) {
  return payload
    .filter((entry) => Array.isArray(entry.segment) && entry.segment.length >= 2)
    .map((entry) => {
      const start = Number(entry.segment[0]);
      const end = Number(entry.segment[1]);

      return {
        ...entry,
        start,
        end,
        autoSkip: categoryModes[entry.category] === "auto",
        skipped: false
      };
    })
    .filter((entry) => Number.isFinite(entry.start) && Number.isFinite(entry.end))
    .filter((entry) => entry.end - entry.start >= minSegmentLength)
    .filter((entry) => entry.end > entry.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

function normalizeMinLength(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaults.sponsorBlock.minSegmentLength;
}

function findCurrentSegment(segments, currentTime, predicate = () => true) {
  return segments.find((segment) => (
    predicate(segment)
      && currentTime >= segment.start
      && currentTime + ACTIVE_SEGMENT_EPSILON < segment.end
  )) || null;
}

function contiguousAutoSegments(segments, firstSegment) {
  const skippedSegments = [firstSegment];
  let targetEnd = firstSegment.end;

  for (const segment of segments) {
    if (!segment.autoSkip || segment.skipped || skippedSegments.includes(segment)) continue;
    if (segment.start > targetEnd + ACTIVE_SEGMENT_EPSILON) continue;
    if (segment.end <= firstSegment.start + ACTIVE_SEGMENT_EPSILON) continue;

    skippedSegments.push(segment);
    targetEnd = Math.max(targetEnd, segment.end);
  }

  return skippedSegments.sort((a, b) => a.start - b.start || a.end - b.end);
}

function skipSegments(player, noteElement, segments, targetTime) {
  for (const segment of segments) {
    segment.skipped = true;
  }

  if (!player) return;

  player.currentTime = targetTime;
  const label = segments.length === 1
    ? labelForCategory(segments[0].category).toLowerCase()
    : `${segments.length} segments`;
  setNote(noteElement, `Skipped ${label}.`);
}

function clearSkipGuards(segments, currentTime) {
  for (const segment of segments) {
    if (currentTime < segment.start - ACTIVE_SEGMENT_EPSILON || currentTime > segment.end + ACTIVE_SEGMENT_EPSILON) {
      segment.skipped = false;
    }
  }
}

function renderTimelineMarkers(element, segments, duration, visible) {
  if (!element) return;

  element.replaceChildren();

  if (!visible || !segments.length || !Number.isFinite(duration) || duration <= 0) {
    element.hidden = true;
    element.style.removeProperty("--playback-progress");
    return;
  }

  for (const segment of segments) {
    const left = clamp((segment.start / duration) * 100, 0, 100);
    const right = clamp((segment.end / duration) * 100, left, 100);
    const marker = document.createElement("span");
    marker.className = "sponsorblock-marker";
    marker.style.left = `${left}%`;
    marker.style.width = `${Math.max(right - left, 0.2)}%`;
    marker.style.backgroundColor = colorForCategory(segment.category);
    marker.title = labelForCategory(segment.category);
    element.append(marker);
  }

  element.hidden = false;
}

function updateTimelineProgress(element, currentTime, duration) {
  if (!element || element.hidden) return;

  const progress = Number.isFinite(currentTime) && Number.isFinite(duration) && duration > 0
    ? clamp((currentTime / duration) * 100, 0, 100)
    : 0;
  element.style.setProperty("--playback-progress", `${progress.toFixed(4)}%`);
}

function updateSkipButton(button, segment) {
  if (!button) return;
  button.hidden = !segment;
  button.disabled = !segment;
  button.textContent = segment ? `Skip ${labelForCategory(segment.category).toLowerCase()}` : "Skip segment";
}

function setNote(element, text) {
  if (element) element.textContent = text;
}

function colorForCategory(category) {
  return sponsorBlockCategoryOptions.find((option) => option.id === category)?.color || "#35c26b";
}

function labelForCategory(category) {
  return sponsorBlockCategoryOptions.find((option) => option.id === category)?.label || "segment";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
