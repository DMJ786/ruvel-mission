# PHASE 0 — WEBMCP SPIKE REPORT

Environment
-----------
Hub URL: `https://ruvel-phase0-hub-dhili.jmsd0811.chatgpt.site/?partnerOrigin=https%3A%2F%2Fruvel-phase0-partner-dhili.jmsd0811.chatgpt.site`

Partner URL: `https://ruvel-phase0-partner-dhili.jmsd0811.chatgpt.site/?hubOrigin=https%3A%2F%2Fruvel-phase0-hub-dhili.jmsd0811.chatgpt.site`

Browser: Codex desktop built-in Chromium browser. External Chrome was not used for T1–T6.

ChatGPT environment: Codex desktop built-in Browser Use WebMCP capability; exact application/runtime version was not exposed.

Date/time tested: 2026-08-31 00:01 AEST (Australia/Sydney).

TLS/environment note: The previous `*.localhost` failure came from an ad-hoc CA and leaf certificate that Windows/Chromium did not trust, so Norton rejected the connection. Phase 0 moved to two public OpenAI Sites production origins. Both returned HTTP 200 through strict certificate verification, reported `isSecureContext === true`, and loaded with no browser console warnings or errors. The hub response used `Permissions-Policy: tools=(self "https://ruvel-phase0-partner-dhili.jmsd0811.chatgpt.site")`; the iframe used `allow="tools"`.

T1 — Native iframe visibility
-----------------------------
Result: **NO**.

Evidence: On the hub, ChatGPT Site Tools listed only the four hub-origin tools: `ping_partner`, `read_probe`, `write_probe`, and `slow_tool`. The partner iframe visibly loaded on its separate secure origin, but showed `document.modelContext unavailable`, `registerTool: false`, and `ping: Unregistered`. When opened as a top-level page, the same partner immediately registered `ping`, which appeared in ChatGPT Site Tools.

Observed behaviour: ChatGPT does not expose `document.modelContext` inside this cross-origin iframe, even with clean HTTPS, the exact hub `Permissions-Policy`, `allow="tools"`, and exact `exposedTo`. The hub's `getTools({ fromOrigins: [partnerOrigin] })` call returned the hub's own four tools rather than a partner tool.

Implication: Do not architect Phase 1 around native iframe tool visibility. Partner-native WebMCP is reliable only when that partner is the top-level document in this environment.

T2 — Cross-origin executeTool
-----------------------------
Result: **NO**.

Evidence: Invoking `hub.ping_partner` failed with `PARTNER_PING_NOT_DISCOVERED`. The discovery step returned the four hub-origin tools, so there was no partner `ping` object to pass to `executeTool()`. As a control, top-level `partner.ping({ message: "direct T4 verification" })` succeeded and returned `{ origin: "partner", received: "direct T4 verification", timestamp: "2026-08-30T14:00:28.707Z" }`.

Observed behaviour: The partner iframe had no WebMCP producer surface, cross-origin discovery did not return partner tools, and cross-origin execution could not begin. This was not a TLS, CORS, access, or Permissions-Policy failure.

Implication: Native hub-to-iframe `getTools()`/`executeTool()` composition is not viable for the hackathon environment tested.

T3 — Long-running approval
--------------------------
Result: **NO for a single pending agent-facing WebMCP call; YES for page-local continuation**.

60s: The page callback remained pending and accepted human approval after **69,896 ms**. The browser's Site Tool call transport had already failed after approximately **24.5 seconds** with `Timed out running CDP command "Runtime.evaluate"`.

120s: The page callback remained pending and accepted human approval after **140,193 ms**. The browser's Site Tool call transport had already failed after approximately **23.7 seconds** with the same timeout.

Observed behaviour: The registered callback received no execution-options object and therefore no `AbortSignal`. After the client timeout, no abort event fired; the page callback continued until its in-page Approve button was clicked.

Implication: Do not keep consequential WebMCP calls pending for human approval. Return an `awaiting_approval` result immediately, persist an approval ID, complete approval in the partner UI, then use a separate continuation/status tool.

T4 — Dynamic toolchange
-----------------------
Result: **PARTIAL**.

Unregister: On the top-level partner page, aborting the registration changed the visible state to Unregistered and ChatGPT immediately announced that WebMCP tools were no longer available. A new fetch returned no tools.

Re-register: Re-registering restored `ping`; ChatGPT announced it as available again, and a direct `ping` invocation succeeded.

ChatGPT Site Tools refresh: **YES for a top-level page. NO for partner-to-hub iframe propagation.** The tested `document.modelContext` object did not implement `addEventListener`, the embedded partner had no WebMCP context, and the hub's toolchange count remained zero.

Implication: AbortSignal-owned registration can power a truthful live `6 → 7` change when the registering document is top-level. Do not depend on iframe-origin `toolchange` propagation or `modelContext.addEventListener` in this runtime.

T5 — Confirmations
------------------
Read-only: `read_probe` completed without a ChatGPT confirmation in **3,842 ms**.

Ordinary write: `write_probe` completed without a ChatGPT confirmation in **2,967 ms**.

Consequential write: `slow_tool` produced no separate ChatGPT confirmation. Its own in-page Approve/Reject controls worked, but the browser Site Tool transport timed out before either long approval completed.

Implication: `readOnlyHint` accurately describes intent but does not establish a dependable confirmation policy. Put the single consequential decision in the partner UI and use the reliable two-step approval protocol from T3.

T6 — Cross-origin access
------------------------
Result: **PARTIAL**.

Steps required: Open the hub URL only. No prior partner navigation, separate ChatGPT site-access grant, authentication, cookie setup, or extra approval was required for the partner iframe to load. The iframe loaded securely and visually on the first hub visit. Its WebMCP tools still did not work because `document.modelContext` was unavailable in the iframe. Opening the partner as a top-level page made its tool available without an additional access flow.

Implication: Cross-origin access/setup is not the blocker; WebMCP's iframe exposure in this ChatGPT environment is the blocker.

Recommended architecture
------------------------
Branch: **D — multi-page mission**.

Reason: Partner WebMCP works when the partner is top-level, while native iframe registration, discovery, execution, and lifecycle propagation do not. Branch D uses only runtime behaviour proven in this spike. A `postMessage` mirror bridge could preserve one-tab composition, but it was not proven by T1–T6 and should not be introduced before a separate, tightly bounded review.

Blocking issues
---------------
1. `document.modelContext` is unavailable in the cross-origin partner iframe despite correct HTTPS and policy configuration.
2. `getTools({ fromOrigins: [partnerOrigin] })` returned hub-origin tools, so native cross-origin `executeTool()` could not be attempted.
3. Agent-facing Site Tool calls time out after roughly 24 seconds, provide no `AbortSignal`, and cannot reliably await long human approval; iframe-driven `toolchange` is also unavailable.

Files created
-------------
- Root workspace: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `eslint.config.mjs`, `.gitignore`.
- Hub: `apps/hub/index.html`, `apps/hub/src/main.ts`, `apps/hub/src/styles.css`, `apps/hub/vite.config.ts`, `apps/hub/tsconfig.json`, `apps/hub/package.json`, `apps/hub/.openai/hosting.json`.
- Partner: `apps/partner/index.html`, `apps/partner/src/main.ts`, `apps/partner/src/styles.css`, `apps/partner/vite.config.ts`, `apps/partner/tsconfig.json`, `apps/partner/package.json`, `apps/partner/.openai/hosting.json`.
- Shared spike code/tests: `packages/spike-core/src/index.ts`, `packages/spike-core/tests/index.test.ts`, `packages/spike-core/package.json`, `packages/spike-core/tsconfig.json`.
- Deployment/documentation: `scripts/write-sites-worker.mjs`, `docs/webmcp-spike.md`, `certs/.gitkeep`.

Commands executed
-----------------
- Installed dependencies with strict TLS verification using the locally trusted Norton root as `cafile`; no TLS verification or browser security was disabled.
- Ran ESLint, TypeScript checks for all three projects, four Vitest tests, and both Vite production builds.
- Generated and syntax-checked self-contained Sites workers, locally verified HTTP 200 and exact policy headers, committed source, pushed the exact commits, saved Sites versions, and deployed both public production origins.
- Performed strict HTTPS fetches against both production URLs and exercised T1–T6 with the Codex built-in browser's WebMCP, DOM, and console inspection surfaces.

Test/build results
------------------
- ESLint: **PASS**.
- TypeScript: **PASS** for `spike-core`, hub, and partner.
- Vitest: **PASS — 4/4 tests**.
- Vite production builds: **PASS** for hub and partner.
- Generated worker syntax/local response tests: **PASS**.
- Deployed HTTPS: **PASS — HTTP 200, secure contexts, exact Permissions-Policy, iframe loaded, zero console warnings/errors**.
- T1: **NO**.
- T2: **NO**.
- T3: **NO for a single long-running WebMCP call; page-local continuation survived**.
- T4: **PARTIAL; live top-level refresh works**.
- T5: **PASS as measurement; no ChatGPT confirmations observed**.
- T6: **PARTIAL; access is clean but iframe WebMCP is unavailable**.

Recommended Phase 1
-------------------
After architectural review, implement one partner end-to-end using Branch D: make the partner a top-level mission page, use real dynamic WebMCP registration there, share only minimal mission state, and use an immediate `awaiting_approval` response plus a separate continuation/status tool. Do not begin Phase 1 until this branch is approved.

Confidence
----------
**High** for the tested Codex built-in browser environment. Runtime behaviour was reproduced on public trusted HTTPS origins with visible page state, Site Tools notifications, returned tool results/errors, elapsed timings, and clean console evidence.
