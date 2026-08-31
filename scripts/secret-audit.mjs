import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function readFingerprints() {
  const values = JSON.parse(fs.readFileSync("artifacts/phase3-secret-fingerprints.json", "utf8")).sha256;
  if (!Array.isArray(values) || values.length !== 2 || values.some(value => !/^[a-f0-9]{64}$/u.test(value))) throw new Error("Secret fingerprints are required for validation");
  return values;
}
export function assertSecretFree(text, label, fingerprints) {
  const expected = new Set(fingerprints);
  const visited = new Set();
  const scan = (value, depth) => {
    if (visited.has(value)) return; visited.add(value);
    for (const match of value.matchAll(/[A-Za-z0-9+/]{64,}={0,2}/gu)) {
      const candidate = match[0];
      for (let index = 0; index <= candidate.length - 64; index++) {
        if (expected.has(createHash("sha256").update(candidate.slice(index, index + 64)).digest("hex"))) throw new Error(`SECRET_LEAK_DETECTED: ${label}`);
      }
      if (depth < 2 && candidate.length < 4_000_000) scan(Buffer.from(candidate, "base64").toString("utf8"), depth + 1);
    }
  };
  scan(String(text), 0);
  try { scan(decodeURIComponent(String(text)), 0); } catch (error) { if (error instanceof Error && error.message.startsWith("SECRET_LEAK_DETECTED")) throw error; }
  scan(String(text).replaceAll("\\/", "/").replace(/\\u00([0-9a-f]{2})/giu, (_, hex) => String.fromCharCode(parseInt(hex, 16))), 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fingerprints = readFingerprints();
  let files = 0;
  const extensions = new Set([".ts", ".js", ".mjs", ".json", ".html", ".css", ".md", ".yaml", ".yml", ".txt", ".log", ".sql"]);
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (["node_modules", ".git", ".pnpm-store", "certs"].includes(entry.name)) continue;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(filename);
      else if (extensions.has(path.extname(filename)) || entry.name.startsWith(".env")) {
        assertSecretFree(fs.readFileSync(filename, "utf8"), filename, fingerprints); files++;
      }
    }
  }
  walk(process.cwd());
  const gitScope = ["-c", `safe.directory=${process.cwd().replaceAll("\\", "/")}`];
  const objects = spawnSync("git", [...gitScope, "rev-list", "--objects", "--all"], { encoding: "utf8", windowsHide: true });
  if (objects.status !== 0) throw new Error("Unable to inspect source history");
  const ids = [...new Set(objects.stdout.trim().split(/\r?\n/u).filter(Boolean).map(line => line.split(" ")[0]))];
  const history = spawnSync("git", [...gitScope, "cat-file", "--batch"], { input: ids.join("\n"), encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (history.status !== 0) throw new Error("Unable to inspect source objects");
  assertSecretFree(history.stdout, "source-control history", fingerprints);
  console.log(JSON.stringify({ status: "PASS", textFilesScanned: files, gitObjectsScanned: ids.length, checks: ["source", "history", "expanded build artifacts", "browser JS/HTML", "E2E reports/attachments", "audit evidence"] }));
}
