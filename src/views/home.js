import { api } from "../api.js";
import { errorState, grid, loading, pageHeader } from "../components.js";
import { setTitle } from "../utils.js";

const view = () => document.getElementById("view");

export async function renderHome() {
  setTitle("");
  view().innerHTML = loading("Loading Invidious");

  try {
    const [popular, trending, stats] = await Promise.allSettled([
      api.popular(),
      api.trending(),
      api.stats()
    ]);

    const popularItems = popular.status === "fulfilled" ? popular.value.slice(0, 12) : [];
    const trendingItems = trending.status === "fulfilled" ? trending.value.slice(0, 12) : [];
    const statsValue = stats.status === "fulfilled" ? stats.value : null;
    const userCount = statsValue?.usage?.users?.total;

    view().innerHTML = `
      ${pageHeader("Watch without the noise", userCount ? `${userCount.toLocaleString()} users on this backend` : "A standalone frontend for your Invidious backend")}
      <section class="section">
        <div class="section-heading">
          <h2>Trending</h2>
          <a href="/feed/trending" data-link>View all</a>
        </div>
        ${grid(trendingItems)}
      </section>
      <section class="section">
        <div class="section-heading">
          <h2>Popular</h2>
          <a href="/feed/popular" data-link>View all</a>
        </div>
        ${grid(popularItems)}
      </section>
    `;
  } catch (error) {
    view().innerHTML = errorState(error);
  }
}
