export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function compactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(number);
}

export function fullNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat().format(number);
}

export function secondsToDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const parts = [];
  let remaining = Math.floor(seconds);
  const hours = Math.floor(remaining / 3600);
  remaining -= hours * 3600;
  const minutes = Math.floor(remaining / 60);
  remaining -= minutes * 60;
  if (hours) parts.push(String(hours));
  parts.push(hours ? String(minutes).padStart(2, "0") : String(minutes));
  parts.push(String(remaining).padStart(2, "0"));
  return parts.join(":");
}

export function relativeTime(unixSeconds) {
  const value = Number(unixSeconds);
  if (!Number.isFinite(value) || value <= 0) return "";
  const diff = value * 1000 - Date.now();
  const abs = Math.abs(diff);
  const divisions = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["week", 1000 * 60 * 60 * 24 * 7],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
    ["second", 1000]
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, amount] of divisions) {
    if (abs >= amount || unit === "second") {
      return formatter.format(Math.round(diff / amount), unit);
    }
  }
  return "";
}

export function parseQuery(search = window.location.search) {
  return Object.fromEntries(new URLSearchParams(search));
}

export function parseYoutubeTime(t) {
  if (!t) return 0;

  if (/^\d+$/.test(t)) {
    return parseInt(t, 10);
  }

  const match = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (match && (match[1] !== undefined || match[2] !== undefined || match[3] !== undefined)) {
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
}


export function setTitle(title) {
  document.title = title ? `${title} - Invidious FE` : "Invidious FE";
}

export function debounce(fn, delay = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function pickThumbnail(thumbnails = [], preferredWidth = 640) {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return "";
  const sorted = [...thumbnails].sort((a, b) => Math.abs((a.width || 0) - preferredWidth) - Math.abs((b.width || 0) - preferredWidth));
  return sorted[0]?.url || thumbnails[0]?.url || "";
}

export function isExternalUrl(url) {
  return /^https?:\/\//i.test(String(url || ""));
}
