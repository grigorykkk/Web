const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT) || 4173;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function resolveRequestPath(requestUrl) {
  const parsedUrl = new URL(requestUrl, `http://${HOST}:${PORT}`);
  const decodedPath = decodeURIComponent(parsedUrl.pathname || "/");
  const pathname = decodedPath === "/" ? "/index.html" : decodedPath;
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  return path.join(ROOT_DIR, safePath);
}

function sendFile(filePath, response) {
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Файл не найден.");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";

    response.writeHead(200, {
      "Content-Length": stats.size,
      "Content-Type": contentType,
      "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600",
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(response);
    stream.on("error", () => {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Ошибка чтения файла.");
    });
  });
}

const server = http.createServer((request, response) => {
  if (!request.url) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Некорректный запрос.");
    return;
  }

  const requestUrl = new URL(request.url, `http://${HOST}:${PORT}`);

  if (requestUrl.pathname === "/__ping") {
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    });
    response.end(JSON.stringify({ ok: true, timestamp: Date.now() }));
    return;
  }

  const filePath = resolveRequestPath(request.url);

  if (!filePath.startsWith(ROOT_DIR)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Доступ запрещен.");
    return;
  }

  sendFile(filePath, response);
});

server.listen(PORT, HOST, () => {
  console.log(`TaskFlow доступен по адресу: http://${HOST}:${PORT}`);
});
