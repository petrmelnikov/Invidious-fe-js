import { pageHeader } from "../components.js";
import { setTitle } from "../utils.js";

const view = () => document.getElementById("view");

export function renderStaticPage(_ctx, page) {
  if (page === "licenses") {
    setTitle("Licenses");
    view().innerHTML = `
      ${pageHeader("JavaScript licenses", "This standalone shell currently ships without third-party runtime packages.")}
      <section class="section text-section">
        <p>The video and media endpoints are provided by the configured Invidious backend. Add third-party libraries here when the frontend starts bundling them.</p>
      </section>
    `;
    return;
  }

  setTitle("Privacy");
  view().innerHTML = `
    ${pageHeader("Privacy", "The frontend stores only local data in your browser.")}
    <section class="section text-section">
      <p>Searches, video requests, comments, and media requests are sent to the configured Invidious backend. Preferences such as backend URL, theme, region, and quality are saved in localStorage on this device. Local account names and watch progress are also stored only in this browser and are never sent to the backend.</p>
    </section>
  `;
}
