import { api } from "../api.js";
import { emptyState, errorState, list, loading, pageHeader } from "../components.js";
import { escapeHtml, setTitle } from "../utils.js";

const view = () => document.getElementById("view");

export async function renderSearch({ search }) {
  const q = search.get("q") || "";
  const sort = search.get("sort_by") || "";
  const type = search.get("type") || "";
  document.getElementById("global-search-input").value = q;
  setTitle(q ? `Search: ${q}` : "Search");

  if (!q.trim()) {
    view().innerHTML = emptyState("Search Invidious", "Type a query above to search videos, channels, and playlists.");
    return;
  }

  view().innerHTML = loading(`Searching for ${q}`);

  try {
    const items = await api.search(q, { sort_by: sort, type });
    view().innerHTML = `
      ${pageHeader(`Search: ${q}`, `${items.length} results`, searchFilters(q, sort, type))}
      ${list(items)}
    `;
  } catch (error) {
    view().innerHTML = errorState(error);
  }
}

function searchFilters(q, sort, type) {
  const sortOptions = ["", "relevance", "rating", "upload_date", "view_count"];
  const typeOptions = ["", "video", "channel", "playlist", "movie"];
  return `
    <form class="filter-row" data-search-filters>
      <input type="hidden" name="q" value="${escapeHtml(q)}">
      <select class="select" name="type" aria-label="Result type">
        ${typeOptions.map((option) => `<option value="${option}" ${option === type ? "selected" : ""}>${option || "all types"}</option>`).join("")}
      </select>
      <select class="select" name="sort_by" aria-label="Sort by">
        ${sortOptions.map((option) => `<option value="${option}" ${option === sort ? "selected" : ""}>${option ? option.replaceAll("_", " ") : "relevance"}</option>`).join("")}
      </select>
      <button class="button" type="submit">Apply</button>
    </form>
  `;
}

document.addEventListener("submit", (event) => {
  if (!event.target.matches("[data-search-filters]")) return;
  event.preventDefault();
  const params = new URLSearchParams(new FormData(event.target));
  for (const [key, value] of [...params.entries()]) {
    if (!value) params.delete(key);
  }
  window.history.pushState({}, "", `/search?${params}`);
  renderSearch({ search: params });
});
