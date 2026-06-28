const ACCOUNTS_KEY = "invidious-fe:accounts";
const CURRENT_ACCOUNT_KEY = "invidious-fe:account";
const PROGRESS_SAVE_THRESHOLD = 3;
const PROGRESS_COMPLETE_THRESHOLD = 5;

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

function accountKey(name) {
  return normalizeName(name).toLowerCase();
}

function normalizeProgressEntry(videoId, entry = {}) {
  const currentTime = Math.max(0, Number(entry.currentTime || 0));
  const duration = Math.max(0, Number(entry.duration || 0));
  const updatedAt = Number(entry.updatedAt || 0) || Date.now();

  return {
    videoId,
    title: String(entry.title || ""),
    author: String(entry.author || ""),
    thumbnail: String(entry.thumbnail || ""),
    currentTime,
    duration,
    updatedAt
  };
}

function normalizeAccount(account = {}, fallbackName = "") {
  const name = normalizeName(account.name || fallbackName);
  const progress = Object.fromEntries(
    Object.entries(account.progress || {})
      .filter(([videoId]) => typeof videoId === "string" && videoId)
      .map(([videoId, entry]) => [videoId, normalizeProgressEntry(videoId, entry)])
  );

  return { name, progress };
}

let cachedAccount = null;

export async function initAccount(name) {
  const normalized = normalizeName(name);
  const key = accountKey(normalized);
  if (!key) {
    cachedAccount = null;
    return null;
  }

  try {
    const response = await fetch(`/api/custom-accounts?name=${encodeURIComponent(normalized)}`);
    if (response.ok) {
      const data = await response.json();
      if (data && typeof data === "object") {
        cachedAccount = normalizeAccount(data, normalized);
        writeJson(ACCOUNTS_KEY, { [key]: cachedAccount });
        return cachedAccount;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch account from backend, using local backup:", err);
  }

  const backup = readJson(ACCOUNTS_KEY, {});
  if (backup[key]) {
    cachedAccount = normalizeAccount(backup[key], normalized);
  } else {
    cachedAccount = { name: normalized, progress: {} };
  }
  return cachedAccount;
}

function loadAccounts() {
  if (cachedAccount) {
    const key = accountKey(cachedAccount.name);
    return { [key]: cachedAccount };
  }

  const key = getCurrentAccountKey();
  if (key) {
    const backup = readJson(ACCOUNTS_KEY, {});
    if (backup[key]) {
      cachedAccount = normalizeAccount(backup[key], key);
      return { [key]: cachedAccount };
    }
  }

  return {};
}

function saveAccounts(accounts) {
  const key = getCurrentAccountKey();
  if (!key) return;

  const account = accounts[key];
  if (!account) return;

  cachedAccount = account;
  writeJson(ACCOUNTS_KEY, { [key]: cachedAccount });

  fetch(`/api/custom-accounts?name=${encodeURIComponent(account.name)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ progress: account.progress })
  }).catch((err) => {
    console.error("Failed to save accounts to backend:", err);
  });
}

export function getCurrentAccountKey() {
  return accountKey(localStorage.getItem(CURRENT_ACCOUNT_KEY) || "");
}

function dispatchAccountChange() {
  const detail = getCurrentAccount();
  window.dispatchEvent(new CustomEvent("accountchange", { detail }));
  return detail;
}

function dispatchProgressChange(detail) {
  window.dispatchEvent(new CustomEvent("accountprogresschange", { detail }));
}

export function getCurrentAccount() {
  const key = getCurrentAccountKey();
  if (!key) return null;

  const accounts = loadAccounts();
  const account = accounts[key];
  if (!account?.name) return null;

  return {
    id: key,
    name: account.name,
    progress: account.progress,
    progressCount: Object.keys(account.progress).length
  };
}

export async function signIn(name) {
  const normalizedName = normalizeName(name);
  const key = accountKey(normalizedName);
  if (!key) return null;

  localStorage.setItem(CURRENT_ACCOUNT_KEY, key);
  await initAccount(normalizedName);
  return dispatchAccountChange();
}

export function signOut() {
  localStorage.removeItem(CURRENT_ACCOUNT_KEY);
  cachedAccount = null;
  return dispatchAccountChange();
}

export function getVideoProgress(videoId) {
  const account = getCurrentAccount();
  if (!account || !videoId) return null;
  return account.progress[videoId] || null;
}

export function listVideoProgress() {
  const account = getCurrentAccount();
  if (!account) return [];

  return Object.values(account.progress)
    .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
}

export function saveVideoProgress(entry = {}) {
  const key = getCurrentAccountKey();
  const videoId = String(entry.videoId || "");
  if (!key || !videoId) return false;

  const accounts = loadAccounts();
  const account = normalizeAccount(accounts[key], key);
  const progressEntry = normalizeProgressEntry(videoId, entry);

  if (progressEntry.duration > 0 && progressEntry.currentTime >= Math.max(progressEntry.duration - PROGRESS_COMPLETE_THRESHOLD, PROGRESS_SAVE_THRESHOLD)) {
    delete account.progress[videoId];
  } else if (progressEntry.currentTime >= PROGRESS_SAVE_THRESHOLD) {
    account.progress[videoId] = progressEntry;
  }

  accounts[key] = account;
  saveAccounts(accounts);
  dispatchProgressChange({ account: account.name, videoId, progress: account.progress[videoId] || null });
  return true;
}

export function clearVideoProgress(videoId) {
  const key = getCurrentAccountKey();
  if (!key || !videoId) return false;

  const accounts = loadAccounts();
  const account = normalizeAccount(accounts[key], key);
  if (!account.progress[videoId]) return false;

  delete account.progress[videoId];
  accounts[key] = account;
  saveAccounts(accounts);
  dispatchProgressChange({ account: account.name, videoId, progress: null });
  return true;
}

export function clearAccountProgress() {
  const key = getCurrentAccountKey();
  if (!key) return false;

  const accounts = loadAccounts();
  const account = normalizeAccount(accounts[key], key);
  account.progress = {};
  accounts[key] = account;
  saveAccounts(accounts);
  dispatchProgressChange({ account: account.name, videoId: null, progress: null });
  return true;
}