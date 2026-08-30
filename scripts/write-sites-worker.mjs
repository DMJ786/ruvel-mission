import fs from "node:fs";
import path from "node:path";

const siteKind = process.argv[2];
if (siteKind !== "hub" && siteKind !== "partner") {
  throw new Error("usage: node scripts/write-sites-worker.mjs <hub|partner>");
}

const serverDirectory = path.resolve(process.cwd(), "dist/server");
fs.mkdirSync(serverDirectory, { recursive: true });

const policyCode =
  siteKind === "hub"
    ? String.raw`
      const requested = new URL(request.url).searchParams.get("partnerOrigin");
      let policy = "tools=(self)";
      if (requested) {
        const partner = new URL(requested);
        if (partner.protocol === "https:") {
          policy = "tools=(self \\\"" + partner.origin + "\\\")";
        }
      }
      headers.set("Permissions-Policy", policy);`
    : 'headers.set("Permissions-Policy", "tools=(self)");';

const worker = `export default {
  async fetch(request, env) {
    const assetResponse = await env.ASSETS.fetch(request);
    const headers = new Headers(assetResponse.headers);
    ${policyCode}
    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  },
};
`;

fs.writeFileSync(path.join(serverDirectory, "index.js"), worker, "utf8");
console.log(`Wrote Sites static worker for ${siteKind}`);
