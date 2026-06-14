const CONFIG_KEY = "invidious-fe:config";

const defaults = {
  apiOrigin: "http://localhost:3000",
  region: "",
  theme: "system",
  quality: "auto",
  comments: "youtube"
};

export function getConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    return { ...defaults, ...saved };
  } catch {
    return { ...defaults };
  }
}

export function saveConfig(nextConfig) {
  const config = { ...getConfig(), ...nextConfig };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  applyTheme(config.theme);
  window.dispatchEvent(new CustomEvent("configchange", { detail: config }));
  return config;
}

export function resetConfig() {
  localStorage.removeItem(CONFIG_KEY);
  applyTheme(defaults.theme);
  window.dispatchEvent(new CustomEvent("configchange", { detail: getConfig() }));
}

export function applyTheme(theme = getConfig().theme) {
  document.documentElement.dataset.theme = theme;
}

export function normalizeOrigin(origin) {
  return String(origin || "")
    .trim()
    .replace(/\/+$/, "");
}

export { defaults };
