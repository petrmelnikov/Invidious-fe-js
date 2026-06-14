import { api } from "../api.js";
import { errorState, grid, loading, pageHeader } from "../components.js";
import { setTitle } from "../utils.js";

const view = () => document.getElementById("view");

export async function renderFeed({ search }, feed) {
  const type = search.get("type") || "Default";
  const title = feed === "popular" ? "Popular" : "Trending";
  setTitle(title);
  view().innerHTML = loading(`Loading ${title.toLowerCase()}`);

  try {
    const items = feed === "popular" ? await api.popular() : await api.trending(type);
    const actions = feed === "trending" ? `
      <select class="select" data-action="trending-type" aria-label="Trending type">
        ${["Default", "Music", "Gaming", "Movies"].map((option) => `<option value="${option}" ${option === type ? "selected" : ""}>${option}</option>`).join("")}
      </select>
    ` : "";

    view().innerHTML = `
      ${pageHeader(title, feed === "popular" ? "Most watched on this backend" : "Current YouTube trends through Invidious", actions)}
      ${grid(items)}
    `;

    view().querySelector("[data-action='trending-type']")?.addEventListener("change", (event) => {
      window.history.pushState({}, "", `/feed/trending?type=${encodeURIComponent(event.target.value)}`);
      renderFeed({ search: new URLSearchParams(window.location.search) }, "trending");
    });
  } catch (error) {
    view().innerHTML = errorState(error);
  }
}
