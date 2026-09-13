import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173),
  host = process.env.HOST || "127.0.0.1";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};
function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end('{"app":"smile-garden","ok":true}');
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      return res.end();
    }
    let name = decodeURIComponent(url.pathname);
    if (name === "/") name = "/index.html";
    const file = path.resolve(root, "." + name),
      relative = path.relative(root, file);
    if (
      relative.startsWith("..") ||
      path.isAbsolute(relative) ||
      relative.split(path.sep).some((s) => s.startsWith("."))
    ) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    const stat = fs.statSync(file);
    if (!stat.isFile()) {
      res.writeHead(404);
      return res.end();
    }
    const etag = `W/"${stat.size}-${Math.trunc(stat.mtimeMs)}"`;
    const cache = relative.startsWith('vendor'+path.sep) ? 'public, max-age=86400' : 'no-cache';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, {'ETag':etag,'Cache-Control':cache});res.end();return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": cache,
      "ETag": etag,
      "X-Content-Type-Options": "nosniff",
      "Permissions-Policy": "camera=(self), microphone=()",
    });
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}
const tls = process.env.TLS_CERT && process.env.TLS_KEY;
const server = tls
  ? https.createServer(
      { cert: fs.readFileSync(process.env.TLS_CERT), key: fs.readFileSync(process.env.TLS_KEY) },
      handler,
    )
  : http.createServer(handler);
server.on("error", (e) => {
  console.error(
    e.code === "EADDRINUSE"
      ? `Port ${port} is occupied. Set PORT to a free port, then start again.`
      : e.message,
  );
  process.exitCode = 1;
});
server.listen(port, host, () =>
  console.log(
    `Smile Garden: ${tls ? "https" : "http"}://${host === "127.0.0.1" ? "localhost" : host}:${port}\nPress Ctrl+C to stop. Mobile cameras require trusted HTTPS.`,
  ),
);
