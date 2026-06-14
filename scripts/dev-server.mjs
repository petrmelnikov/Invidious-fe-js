import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const portArgIndex = process.argv.findIndex((arg) => arg === "--port" || arg === "-p");
const port = Number(portArgIndex >= 0 ? process.argv[portArgIndex + 1] : process.env.PORT || 5173);

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".ico", "image/x-icon"],
  [".webmanifest", "application/manifest+json"]
]);

function resolvePath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const target = resolve(join(root, normalized));

  if (!target.startsWith(root)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  return join(root, "index.html");
}

const server = createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (requestUrl.pathname === "/proxy") {
    proxyRequest(req, res, requestUrl);
    return;
  }

  if (requestUrl.pathname === "/dash-manifest") {
    dashManifestRequest(req, res, requestUrl);
    return;
  }

  const filePath = resolvePath(req.url || "/");

  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const contentType = mime.get(extname(filePath)) || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  createReadStream(filePath).pipe(res);
});

async function proxyRequest(req, res, requestUrl) {
  const target = requestUrl.searchParams.get("url");

  if (!target || !/^https?:\/\//i.test(target)) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Missing proxy url");
    return;
  }

  try {
    const headers = {};
    for (const name of ["range", "accept", "accept-language", "user-agent"]) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      redirect: "follow"
    });

    const responseHeaders = {};
    const blockedHeaders = new Set([
      "connection",
      "content-encoding",
      "content-security-policy",
      "permissions-policy",
      "referrer-policy",
      "transfer-encoding",
      "x-content-type-options",
      "x-frame-options",
      "x-xss-protection"
    ]);

    for (const [key, value] of upstream.headers) {
      if (!blockedHeaders.has(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    }
    responseHeaders["Access-Control-Allow-Origin"] = "*";

    res.writeHead(upstream.status, responseHeaders);
    if (req.method === "HEAD" || !upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error?.message || "Proxy request failed");
  }
}

async function dashManifestRequest(_req, res, requestUrl) {
  const target = requestUrl.searchParams.get("url");

  if (!target || !/^https?:\/\//i.test(target)) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Missing manifest url");
    return;
  }

  try {
    const upstream = await fetch(target, { redirect: "follow" });
    if (!upstream.ok) {
      res.writeHead(upstream.status, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(await upstream.text());
      return;
    }

    const upstreamUrl = new URL(upstream.url);
    const manifest = await upstream.text();
    const rewritten = manifest.replace(/<BaseURL>([^<]+)<\/BaseURL>/g, (_match, rawUrl) => {
      const decoded = rawUrl.replaceAll("&amp;", "&");
      const absolute = new URL(decoded, upstreamUrl.origin).toString();
      const proxied = `/proxy?url=${encodeURIComponent(absolute)}`;
      return `<BaseURL>${proxied.replaceAll("&", "&amp;")}</BaseURL>`;
    });

    res.writeHead(200, {
      "Content-Type": "application/dash+xml; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    });
    res.end(rewritten);
  } catch (error) {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error?.message || "DASH manifest request failed");
  }
}

server.listen(port, () => {
  console.log(`Invidious FE running at http://localhost:${port}`);
  console.log(`Serving ${root}`);
});
