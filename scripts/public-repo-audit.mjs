import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const git = (...args) => {
  const result = spawnSync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args], { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Git audit command failed: ${args[0]}`);
  return result.stdout;
};

const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
const forbiddenFiles = tracked.filter(file =>
  /(^|\/)(?:artifacts|test-results|playwright-report|node_modules|\.pnpm-store)(?:\/|$)/u.test(file)
  || /\.(?:zip|trace|har|tgz|tar\.gz)$/iu.test(file)
  || /(^|\/)\.env(?:\.|$)/u.test(file) && file !== ".env.example"
  || /^certs\/(?!\.gitkeep$)/u.test(file)
);
if (forbiddenFiles.length) throw new Error(`PUBLIC_REPO_BLOCKED_FILES: ${forbiddenFiles.length}`);

const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
for (const required of ["artifacts/", "test-results/", "playwright-report/", ".env", ".env.local", "certs/*.pem", "certs/*.cer"]) {
  if (!ignore.split(/\r?\n/u).includes(required)) throw new Error(`PUBLIC_REPO_MISSING_IGNORE: ${required}`);
}

const history = git("log", "--all", "-p", "--text", "--", ".");
const current = tracked.flatMap(file => {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) return [];
  const value = fs.readFileSync(absolute);
  if (value.includes(0)) return [];
  return [`\nFILE:${file}\n${value.toString("utf8")}`];
}).join("");
const corpus = `${current}\n${history}`;

const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
  ["GitHub token", /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/u],
  ["common API token", /\b(?:glpat-|sk-(?:proj-)?)[A-Za-z0-9_-]{20,}\b/u],
  ["credential in URL", /https?:\/\/[^\s/@:]+:[^\s/@]+@/u],
  ["validation mission handle", /\bm_[0-9a-f]{32}\b/iu],
  ["local Windows user path", /\b[A-Z]:\\Users\\[^\\\s]+\\/iu],
  ["local Unix user path", /\/(?:Users|home)\/[^/\s]+\//u],
];
for (const [label, pattern] of patterns) if (pattern.test(corpus)) throw new Error(`PUBLIC_REPO_SENSITIVE_PATTERN: ${label}`);

const nonEmptyEnv = current.match(/^(?:[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)[A-Z0-9_]*)[ \t]*=[ \t]*[^\s#]+/gmu) ?? [];
if (nonEmptyEnv.length) throw new Error(`PUBLIC_REPO_NONEMPTY_SECRET_ASSIGNMENT: ${nonEmptyEnv.length}`);

console.log(JSON.stringify({
  status: "PASS",
  trackedFiles: tracked.length,
  historyCommits: git("rev-list", "--count", "--all").trim(),
  checks: ["forbidden tracked files", "ignore coverage", "private keys", "token formats", "credential URLs", "validation handles", "local user paths", "non-empty secret assignments"],
}));
