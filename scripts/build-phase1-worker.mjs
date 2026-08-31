import fs from "node:fs";
import path from "node:path";
import { build } from "vite";

const siteKind = process.argv[2];
if (!["mission", "brightenergy", "civicaid"].includes(siteKind)) {
  throw new Error("usage: node scripts/build-phase1-worker.mjs <mission|brightenergy|civicaid>");
}

const rootDirectory = process.cwd();
const projectDirectory = path.join(rootDirectory, "apps", siteKind);
const distDirectory = path.join(projectDirectory, "dist");
const serverDirectory = path.join(distDirectory, "server");
fs.mkdirSync(serverDirectory, { recursive: true });

const types = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
]);

const files = {};
for (const entry of fs.readdirSync(distDirectory, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || entry.parentPath.includes(`${path.sep}server`)) continue;
  const absolute = path.join(entry.parentPath, entry.name);
  const relative = path.relative(distDirectory, absolute).replaceAll("\\", "/");
  if (relative.startsWith(".openai/")) continue;
  files[`/${relative}`] = {
    body: fs.readFileSync(absolute).toString("base64"),
    type: types.get(path.extname(absolute)) ?? "application/octet-stream",
  };
}

await build({
  configFile: false,
  root: rootDirectory,
  define: {
    __PHASE1_FILES__: JSON.stringify(files),
    __PHASE1_SITE_KIND__: JSON.stringify(siteKind),
  },
  build: {
    emptyOutDir: true,
    outDir: serverDirectory,
    target: "es2022",
    lib: { entry: path.join(rootDirectory, "scripts/phase1-worker-entry.ts"), formats: ["es"] },
    rollupOptions: { output: { entryFileNames: "index.js" } },
  },
});
