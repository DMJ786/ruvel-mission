import fs from "node:fs";
import path from "node:path";

const siteKind = process.argv[2];
if (siteKind !== "hub" && siteKind !== "partner") {
  throw new Error("usage: node scripts/write-sites-worker.mjs <hub|partner>");
}

const distDirectory = path.resolve(process.cwd(), "dist");
const serverDirectory = path.join(distDirectory, "server");
fs.mkdirSync(serverDirectory, { recursive: true });

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

const embeddedFiles = {};
for (const entry of fs.readdirSync(distDirectory, { withFileTypes: true })) {
  if (entry.name === "server" || entry.name === ".openai") continue;
  const absoluteEntry = path.join(distDirectory, entry.name);
  const files = entry.isDirectory()
    ? fs
        .readdirSync(absoluteEntry, { recursive: true, withFileTypes: true })
        .filter((candidate) => candidate.isFile())
        .map((candidate) => path.join(candidate.parentPath, candidate.name))
    : [absoluteEntry];

  for (const absoluteFile of files) {
    const pathname = `/${path.relative(distDirectory, absoluteFile).replaceAll("\\", "/")}`;
    embeddedFiles[pathname] = {
      body: fs.readFileSync(absoluteFile).toString("base64"),
      type: contentTypes.get(path.extname(absoluteFile)) ?? "application/octet-stream",
    };
  }
}

const policyCode =
  siteKind === "hub"
    ? String.raw`
      const requested = new URL(request.url).searchParams.get("partnerOrigin");
      let policy = "tools=(self)";
      if (requested) {
        const partner = new URL(requested);
        if (partner.protocol === "https:") {
          policy = 'tools=(self "' + partner.origin + '")';
        }
      }
      headers.set("Permissions-Policy", policy);`
    : 'headers.set("Permissions-Policy", "tools=(self)");';

const worker = `const files = ${JSON.stringify(embeddedFiles)};

function decodeBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = files[pathname];
    const headers = new Headers();
    ${policyCode}
    headers.set("X-Content-Type-Options", "nosniff");
    if (!file) return new Response("Not Found", { status: 404, headers });
    headers.set("Content-Type", file.type);
    if (pathname.startsWith("/assets/")) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      headers.set("Cache-Control", "no-store");
    }
    return new Response(decodeBase64(file.body), { status: 200, headers });
  },
};
`;

fs.writeFileSync(path.join(serverDirectory, "index.js"), worker, "utf8");
console.log(`Wrote Sites static worker for ${siteKind}`);
