const http = require("http");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

function getArgValue(flag, fallback) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return fallback;
}

const host = getArgValue("--host", "0.0.0.0");
const port = Number(getArgValue("--port", process.env.PORT || "8080"));
const rootDir = process.cwd();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function getSafePath(requestUrl) {
  const rawPath = decodeURIComponent(requestUrl.split("?")[0]);
  const normalizedPath = path.normalize(rawPath).replace(/^([.][.][/\\])+/, "");
  const requestedPath = normalizedPath === "/" ? "/index.html" : normalizedPath;
  return path.join(rootDir, requestedPath);
}

function sendFile(filePath, res) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (error.code === "ENOENT") {
        const indexPath = path.join(rootDir, "index.html");
        fs.readFile(indexPath, (indexError, indexData) => {
          if (indexError) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Not found");
            return;
          }

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(indexData);
        });
        return;
      }

      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Server error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const filePath = getSafePath(req.url || "/");

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isDirectory()) {
      sendFile(path.join(filePath, "index.html"), res);
      return;
    }

    sendFile(filePath, res);
  });
});

server.listen(port, host, () => {
  console.log(`Gothic Lockpick is available on: http://${host}:${port}`);
  console.log("Use your machine's LAN IP (for example, http://192.168.x.x:8080) from other devices.");
});
