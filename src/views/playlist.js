import { api } from "../api.js";
import { errorState, list, loading, pageHeader } from "../components.js";
import { escapeHtml, setTitle } from "../utils.js";

const view = () => document.getElementById("view");

export async function renderPlaylist({ search }) {
  const plid = search.get("list") || search.get("plid");
  if (!plid) {
    view().innerHTML = errorState(new Error("Missing playlist id"));
    return;
  }

  view().innerHTML = loading("Loading playlist");

  try {
    const playlist = await api.playlist(plid);
    setTitle(playlist.title || "Playlist");
    const videos = playlist.videos || playlist.contents || [];
    view().innerHTML = `
      ${pageHeader(playlist.title || "Playlist", playlist.author ? `By ${playlist.author}` : "", playlist.videoCount ? `<span class="pill">${escapeHtml(String(playlist.videoCount))} videos</span>` : "")}
      ${playlist.description ? `<section class="description"><p>${escapeHtml(playlist.description)}</p></section>` : ""}
      ${list(videos)}
    `;
  } catch (error) {
    view().innerHTML = errorState(error);
  }
}
