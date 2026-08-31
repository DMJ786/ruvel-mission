import { handleDurableRequest, type DurableSite, type DurableEnv } from "../packages/mission-core/src/durable-server";

declare const __PHASE1_FILES__: Record<string, { body: string; type: string }>;
declare const __PHASE1_SITE_KIND__: DurableSite;

function decode(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export default {
  async fetch(request: Request, env: DurableEnv) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleDurableRequest(request, env, __PHASE1_SITE_KIND__);
    }
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = __PHASE1_FILES__[pathname];
    const headers = new Headers({
      "Permissions-Policy": "tools=(self)",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    // The bounded demo has no favicon asset; answer browser auto-requests explicitly.
    if (pathname === "/favicon.ico" && !file) return new Response(null, { status: 204, headers });
    if (!file) return new Response("Not Found", { status: 404, headers });
    headers.set("Content-Type", file.type);
    headers.set("Cache-Control", pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-store");
    return new Response(decode(file.body), { status: 200, headers });
  },
};
