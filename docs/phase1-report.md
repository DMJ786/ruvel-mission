# PHASE 1 — BRIGHTENERGY END-TO-END REPORT

## Architecture

Shared state implementation: A signed portable mission envelope carries deterministic, non-PII Passport, BrightEnergy, approval, and audit state between the two HTTPS origins in the URL fragment. Each page immediately moves the envelope into origin-scoped session storage and clears the fragment. Both servers share a privately configured signing secret and independently verify every request.

Passport implementation: HMAC-SHA-256 signed, versioned, one-hour Passport with mission ID, issue/expiry timestamps, BrightEnergy scopes, and allowed/forbidden disclosure categories. State changes increment the version.

Approval protocol: `change_plan` is a two-mode tool. The first call returns `awaiting_approval` immediately and stores a pending approval. A later human click records approval. A second call with `approvalId` completes after scope, mission, expiry, approval, and idempotency checks.

Deployment URLs:

- Ruvel Mission: `https://ruvel-phase1-mission-dhili.jmsd0811.chatgpt.site/?brightOrigin=https%3A%2F%2Fruvel-phase1-brightenergy-dhili.jmsd0811.chatgpt.site`
- BrightEnergy: `https://ruvel-phase1-brightenergy-dhili.jmsd0811.chatgpt.site`

## WebMCP

Initial registered tools: `get_account_summary`, `apply_hardship`.

Dynamic grant behaviour: Human grant updates and re-signs the Passport, increments its version, appends `capability_granted:change_plan`, and registers `change_plan` at the top level. The real registration count changes from 2 to 3.

Site Tools refresh behaviour: Verified in the deployed Codex in-app browser. The runtime notification and fetched Site Tools surface changed live from the two base tools to all three tools without navigation or reload.

Registration latency: Approximately 620 ms from the grant click through signed-state update, successful registration, and visible count update in the live runtime check.

## Security

Server scope denial: Verified in unit tests and all three deployed Playwright runs. A direct pre-grant `change_plan` action returns HTTP 403 with `{ "error": "MISSION_SCOPE_DENIED", "capability": "brightenergy.change_plan" }`.

Passport verification: Valid signatures accepted; invalid/expired Passports rejected; each state-changing partner action checks the currently signed scope. No real PII is included.

Approval verification: Continuation verifies mission ownership, ten-minute approval expiry, current scope, human approval, and completion state. An authorized but unapproved continuation is rejected.

Idempotency: The first approved continuation applies Saver Flex and records completion. A duplicate returns the existing completed result with `idempotent: true` and does not repeat the mutation or audit completion.

## Golden Path

Run 1: PASS — deployed Playwright journey, 27.0 s.

Run 2: PASS — deployed Playwright journey, 10.6 s.

Run 3: PASS — deployed Playwright journey, 6.1 s.

An additional real Codex WebMCP runtime run passed: two initial tools; live grant to three; account read; hardship application; plan request returned `awaiting_approval` in 5.492 s; independent human approval; successful continuation; duplicate idempotent continuation; return to a complete hub with all 11 required ordered audit events. No browser console errors or warnings were recorded.

## Reset Demo

Result: PASS. Reset created a new mission with Standard Flex, $146/month, no hardship, no plan-change grant, no approvals, and only the two initial registered WebMCP tools. The deployed runtime was re-entered after reset and confirmed a real capability count of 2.

## Tests

Lint: PASS (`eslint .`).

Typecheck: PASS for all six workspace projects plus root/e2e configuration.

Unit: PASS — 15 tests total (11 Phase 1, 4 retained Phase 0).

E2E: PASS — three consecutive deployed Playwright golden-path runs. The Playwright harness supplies the draft WebMCP browser contract so tool registrations and callbacks can be exercised deterministically; the same registrations and calls were separately verified against the real Codex runtime.

Build: PASS — all four applications and both shared packages, including both Cloudflare-compatible Phase 1 workers.

## Known Issues

1. The portable signed envelope is intentionally single-device Phase 1 infrastructure. It does not provide durable recovery, centralized revocation, or concurrent multi-partner conflict handling.
2. Audit growth increases the navigation fragment size. Phase 1 remains comfortably bounded, but later phases should move canonical state to durable shared storage.
3. The current continuation keeps the tool count at the requested 2→3 by using `change_plan` for both request and completion. A dedicated continuation tool may become clearer if later partners introduce multiple simultaneous approvals.

## Files / modules added

- `apps/mission`: Ruvel Mission hub UI, navigation, reset, Passport approval, audit and outcome rendering.
- `apps/brightenergy`: fictional authenticated account UI, authority controls, dynamic top-level WebMCP registration, approval UI, and return navigation.
- `packages/mission-core`: state model, HMAC token implementation, server actions, Passport enforcement, approval protocol, and tests.
- `e2e/phase1-golden-path.spec.ts`: three-run deployed Playwright journey.
- `scripts/build-phase1-worker.mjs` and `scripts/phase1-worker-entry.ts`: Cloudflare-compatible Sites worker packaging with API and security headers.
- `docs/decisions.md`: accepted Branch D ADR.
- `docs/architecture.md`: current multi-page product and security architecture.

## Recommended Phase 2

Review Phase 1 with the deployed URLs first. If accepted, extract only the proven partner contract, choose durable shared state for multi-partner concurrency, then add CivicAid before NextStep. Preserve the top-level partner model and asynchronous approval boundary.

## Confidence

High.
