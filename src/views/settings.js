import { apiOrigin } from "../api.js";
import { defaults, getConfig, resetConfig, saveConfig } from "../config.js";
import { pageHeader } from "../components.js";
import { escapeHtml, setTitle } from "../utils.js";

const view = () => document.getElementById("view");

export function renderSettings() {
  setTitle("Settings");
  const config = getConfig();
  view().innerHTML = `
    ${pageHeader("Settings", "This frontend stores preferences locally in your browser.")}
    <form class="settings-form" id="settings-form">
      <label>
        Backend URL
        <input name="apiOrigin" type="url" required value="${escapeHtml(config.apiOrigin)}" placeholder="http://localhost:3000">
      </label>

      <label>
        Region
        <input name="region" value="${escapeHtml(config.region)}" placeholder="US, DE, IL...">
      </label>

      <label>
        Theme
        <select name="theme" class="select">
          ${option("system", "System", config.theme)}
          ${option("dark", "Dark", config.theme)}
          ${option("light", "Light", config.theme)}
        </select>
      </label>

      <label>
        Preferred quality
        <select name="quality" class="select">
          ${option("auto", "Auto", config.quality)}
          ${option("1080p", "1080p", config.quality)}
          ${option("720p", "720p", config.quality)}
          ${option("480p", "480p", config.quality)}
          ${option("360p", "360p", config.quality)}
        </select>
      </label>

      <label>
        Comments source
        <select name="comments" class="select">
          ${option("youtube", "YouTube", config.comments)}
          ${option("reddit", "Reddit", config.comments)}
        </select>
      </label>

      <div class="form-actions">
        <button class="button" type="submit">Save</button>
        <button class="button button-ghost" type="button" id="reset-settings">Reset</button>
      </div>
    </form>

    <section class="section">
      <div class="section-heading"><h2>Current API</h2></div>
      <code class="code-block">${escapeHtml(apiOrigin())}/api/v1</code>
    </section>
  `;

  document.getElementById("settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    saveConfig({
      apiOrigin: form.apiOrigin || defaults.apiOrigin,
      region: form.region,
      theme: form.theme,
      quality: form.quality,
      comments: form.comments
    });
    renderSettings();
  });

  document.getElementById("reset-settings").addEventListener("click", () => {
    resetConfig();
    renderSettings();
  });
}

function option(value, label, selected) {
  return `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`;
}
