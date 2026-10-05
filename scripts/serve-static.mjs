// Maha Duck — local preview server (no install needed, just Node.js)
// Usage:  npm run dev        (or: node scripts/serve-static.mjs)
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { exec } from "node:child_process";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Always serve the "dist" folder next to this script, no matter where the terminal is opened.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(projectRoot, process.argv[2] || "dist");
let port = Number(process.argv[3] || process.env.PORT || 4173);
const openBrowser = !process.argv.includes("--no-open");

if (!existsSync(join(root, "index.html"))) {
  console.error(`\n✖ index.html not found in ${root}\n  Run this from the "Maha Duck" folder: npm run dev\n`);
  process.exit(1);
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function fileForUrl(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const requested = resolve(join(root, normalize(pathname)));
  if (!requested.startsWith(root)) return null;
  if (existsSync(requested) && statSync(requested).isFile()) return requested;
  const indexFile = join(requested, "index.html");
  if (existsSync(indexFile)) return indexFile;
  if (extname(requested)) return null; // missing file → 404 (not the home page)
  return join(root, "index.html");
}

const server = createServer((req, res) => {
  const file = fileForUrl(req.url || "/");
  if (!file) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found: " + req.url);
    console.warn("404", req.url);
    return;
  }
  res.writeHead(200, { "content-type": types[extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).pipe(res);
});

function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list || []) if (a.family === "IPv4" && !a.internal) return a.address;
  }
  return null;
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE" && port < 4200) {
    console.log(`Port ${port} is busy, trying ${port + 1}…`);
    port += 1;
    server.listen(port, "0.0.0.0");
  } else {
    console.error(err);
    process.exit(1);
  }
});

server.listen(port, "0.0.0.0", () => {
  const local = `http://localhost:${port}`;
  const lan = lanAddress();
  console.log(`\n  🦆 Maha Duck is running\n`);
  console.log(`  Customer site : ${local}/`);
  console.log(`  Dashboard     : ${local}/admin.html`);
  if (lan) console.log(`  On your phone : http://${lan}:${port}/   (same Wi-Fi)`);
  console.log(`\n  Press Ctrl+C to stop.\n`);
  if (openBrowser) {
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start \"\"" : "xdg-open";
    exec(`${cmd} ${local}/`, () => {});
  }
});
