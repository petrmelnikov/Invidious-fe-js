const routes = [];
let notFoundHandler = () => "";

export function route(pattern, handler) {
  const keys = [];
  const expression = pattern
    .replace(/\/+$/, "")
    .replace(/:[^/]+/g, (match) => {
      keys.push(match.slice(1));
      return "([^/]+)";
    });
  routes.push({ regex: new RegExp(`^${expression || "/"}$`), keys, handler });
}

export function notFound(handler) {
  notFoundHandler = handler;
}

export function navigate(path) {
  if (window.location.pathname + window.location.search === path) return;
  history.pushState({}, "", path);
  renderRoute();
}

export async function renderRoute() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  for (const candidate of routes) {
    const match = path.match(candidate.regex);
    if (match) {
      const params = Object.fromEntries(candidate.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
      await candidate.handler({ params, search: new URLSearchParams(window.location.search) });
      return;
    }
  }
  await notFoundHandler({ params: {}, search: new URLSearchParams(window.location.search) });
}

export function installRouter() {
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[data-link]");
    if (!anchor) return;
    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin) return;

    event.preventDefault();
    navigate(`${url.pathname}${url.search}${url.hash}`);
  });

  window.addEventListener("popstate", renderRoute);
}
