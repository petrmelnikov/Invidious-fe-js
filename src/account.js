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

function loadAccounts() {
  const accounts = readJson(ACCOUNTS_KEY, {});
  return Object.fromEntries(
    Object.entries(accounts)
      .filter(([key]) => typeof key === "string" && key)
      .map(([key, account]) => [key, normalizeAccount(account, key)])
  );
}

function saveAccounts(accounts) {
  writeJson(ACCOUNTS_KEY, accounts);
}

function getCurrentAccountKey() {
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

export function signIn(name) {
  const normalizedName = normalizeName(name);
  const key = accountKey(normalizedName);
  if (!key) return null;

  const accounts = loadAccounts();
  const existing = accounts[key];
  accounts[key] = normalizeAccount(existing || { name: normalizedName }, normalizedName);
  saveAccounts(accounts);
  localStorage.setItem(CURRENT_ACCOUNT_KEY, key);
  return dispatchAccountChange();
}

export function signOut() {
  localStorage.removeItem(CURRENT_ACCOUNT_KEY);
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