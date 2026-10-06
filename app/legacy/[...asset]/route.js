import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

export const runtime = "nodejs";

const root = resolve(process.cwd(), "dist");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
const mutableTypes = new Set([".css", ".html", ".js", ".json"]);

export async function GET(_request, { params }) {
  const { asset = [] } = await params;
  const file = resolve(root, ...asset);
  if (file !== root && !file.startsWith(root + sep)) return new Response("Not found", { status: 404 });

  try {
    const data = await readFile(file);
    const ext = extname(file).toLowerCase();
    return new Response(data, {
      headers: {
        "Content-Type": contentTypes[ext] || "application/octet-stream",
        "Cache-Control": mutableTypes.has(ext) ? "public, max-age=0, must-revalidate" : "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
