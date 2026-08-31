# PHASE 2 — CIVICAID + DURABLE MISSION REPORT

Validated 2026-08-31. **Deployment and validation complete; awaiting user review.** This does not imply user acceptance or authorize Phase 3.

## Public URLs

- [Ruvel Mission](https://ruvel-phase1-mission-dhili.jmsd0811.chatgpt.site) — existing URL preserved.
- [BrightEnergy](https://ruvel-phase1-brightenergy-dhili.jmsd0811.chatgpt.site) — existing URL preserved.
- [CivicAid](https://ruvel-civicaid-dhili.jmsd0811.chatgpt.site) — distinct public HTTPS origin.

Start at Ruvel and approve a Passport before visiting partners. Direct partner roots intentionally have no mission authority. All three origins opened over trusted HTTPS with no certificate interstitial. TLS verification, Norton, CSP and browser security were not disabled. Citizens, accounts, identifiers, claims, employment information and amounts are fictional. Signing/service credentials remain server-only Sites secrets, absent from public artifacts and browser responses.

## Architecture

**Storage:** Sites-managed D1 on Ruvel, with a generated SQL migration, canonical signed records, timestamps and compare-and-swap revision writes. No production in-memory or browser-storage fallback.

**Mission handle:** Random `m_` plus 32 hexadecimal characters. Navigation carries only `?mission=<opaque handle>`. No Passport, state, approvals, disclosure policy or audit is encoded in URLs. Legacy Phase 1 snapshots are removed, not imported as authoritative state.

**Passport resolution:** Partner servers resolve the current canonical record through authenticated HTTP, independently verify signature/expiry/scope, then forward the action. Ruvel re-verifies the latest record before committing. Public clients cannot submit authoritative Passport/state snapshots.

**Migration result:** All BrightEnergy regressions pass. Its interaction, tool schemas, bounded grant and two-step approval are unchanged. D1 state survived origin changes and a fresh browser context carrying only the handle. See [architecture](./architecture.md) and [ADRs](./decisions.md).

## CivicAid WebMCP

**Registered tools:** Exactly `check_eligibility` and `prepare_support_claim`, both with empty object schemas and `additionalProperties: false`. Eligibility advertises `readOnlyHint: true`.

**Identity resolution:** A signed, Secure, HttpOnly site-local fictional session resolves CivicAid's citizen and records. Cookie isolation is unit-tested; deployed E2E verifies the secure session cookie.

**Tool argument privacy:** Both native calls used `{}`. The actual invocation panel displayed both calls and a computed identifier count of **0**. Eligibility returned the demo **$782/fortnight** estimate. Claim preparation returned **5 prepared fields and 1 human-input field**, matching the six displayed fields. No claim was submitted.

**Observed Site Tools behaviour:** The Codex in-app browser discovered and invoked real page tools, separately from the injected contract harness used in automated Edge E2E. Final-public-version native timings: eligibility **4.342s**, claim preparation **4.078s**, including browser-tool transport overhead.

## Cross-Partner Mission

**CivicAid persistence:** COMPLETE on return to Ruvel, retained through BrightEnergy and CivicAid re-entry.

**BrightEnergy persistence:** Saver Flex and hardship relief retained at Ruvel and through subsequent CivicAid navigation.

**Hub aggregation:** Both partners displayed COMPLETE from canonical state. The native journey showed **15 central events** from both origins. Each automated golden run also opened the completed handle in a fresh browser context and verified both statuses without previous app storage.

## BrightEnergy Regression

**Dynamic 2→3:** Initial native tools were exactly `get_account_summary` and `apply_hardship`; `change_plan` was absent. Granting scope added the third tool without navigation. Codex issued a live tools-available notification containing all three.

**Server denial:** Pre-grant direct requests returned HTTP **403**, `MISSION_SCOPE_DENIED`, capability `brightenergy.change_plan`, in all final deployed golden runs.

**Approval:** The final native `change_plan({plan: "saver_flex"})` returned `awaiting_approval` in **4.304s**. Standard Flex remained current until a separate approval UI action and continuation. Browser automation exercised that UI to simulate the human role; approval was not implicit in the WebMCP request. Continuation completed in **4.896s**. An earlier public native run returned pending in 5.760s, also without transport timeout.

**Idempotency:** Repeating continuation returned `status: completed` and `idempotent: true`, without another plan-change completion event.

**Reset:** Both partners, grant, hardship, approvals and audit reset on the same handle with a new Passport generation. CivicAid becomes unchecked/no claim; BrightEnergy becomes Standard Flex/$146/no hardship, without `change_plan`. Reapproval restores each site's two initial real tools; before reapproval, tools remain unavailable by design. Verified by deployed E2E and native browser.

## Audit

**CivicAid events:** Actual `tool_invoked`/`tool_completed` for both capabilities, with configured origin, timestamp, redacted arguments and result summary.

**BrightEnergy events:** Account read, hardship, dynamic grant, approval request, independent approval and plan-change completion.

**Redaction result:** CivicAid arguments were `{}`, identifier count 0. Unit tests cover identity-like key redaction; CivicAid rejects unexpected arguments. Known plan/program constants are retained; other argument values, including continuation identifiers, are redacted. The supported privacy claim is session-local identity resolution, not that an AI never sees site data.

## Golden Path

Three consecutive full deployed two-partner runs, one worker, no retries:

| Run | Full test duration | Pending response (API/harness) | Result |
| --- | ---: | ---: | --- |
| 1 | 34.200s | 1.004s | PASS |
| 2 | 38.762s | 1.186s | PASS |
| 3 | 31.540s | 1.353s | PASS |

Durations include both partners, scope denial, separate approval, duplicate continuation, fresh-context durability and final reset. Native transport timings are reported separately above. BrightEnergy-only regressions passed in **30.531s, 25.085s, 22.833s**.

## Tests

| Gate | Result |
| --- | --- |
| Lint | PASS |
| Typecheck | PASS: all app/package projects plus root/config/E2E |
| Unit/integration | 27/27 PASS: 4 Phase 0, 11 Phase 1, 12 Phase 2 |
| Build | PASS: all five applications, including all three Phase 2 workers |
| Final deployed E2E | 6/6 PASS; 0 skipped/flaky/retries; 187.372s suite wall time |
| Real WebMCP | PASS in Codex's in-app browser, repeated on the final public version |
| Trusted HTTPS | PASS on all three origins; no certificate-error bypass |
| Consoles | Checked all origins; no unexpected application console/page errors; platform caveats below |

The mission project skips dependency declaration checks because Drizzle includes unrelated optional database-driver declarations; application source remains strictly checked. Node's experimental SQLite warning is confined to the local test adapter, not deployed D1.

## Deployment acceptance matrix

| # | Requirement | Result/evidence |
| --- | --- | --- |
| 1 | Opaque mission creation | PASS; format assertions and native address bar |
| 2 | No fragment state/Passport/audit/approval | PASS; only `mission` query, empty fragment |
| 3 | Durable D1 across origins | PASS; both partners and fresh browser context |
| 4 | CivicAid top-level HTTPS | PASS; independent public origin, no iframe |
| 5 | Real CivicAid WebMCP | PASS; native discovery/execution |
| 6 | Eligibility without identity arguments | PASS; `{}` |
| 7 | Claim preparation without identity arguments | PASS; `{}` |
| 8 | Site-session citizen resolution | PASS; signed local fictional session |
| 9 | CivicAid COMPLETE at hub | PASS; native and golden runs |
| 10 | Exactly two initial BrightEnergy tools | PASS; native discovery and harness |
| 11 | Initial `change_plan` absent | PASS |
| 12 | Actual 2→3 registration | PASS |
| 13 | Live Site Tools refresh | PASS in tested Codex runtime; no reload |
| 14 | Pre-grant direct denial | PASS; exact HTTP 403 `MISSION_SCOPE_DENIED` |
| 15 | Prompt pending response | PASS; native 4.304s; final automated calls under 1.4s |
| 16 | Independent human approval boundary | PASS; separate approval UI action |
| 17 | Idempotent continuation | PASS; repeated response explicitly idempotent |
| 18 | Both partner states at Ruvel | PASS; both COMPLETE |
| 19 | Both origins in durable audit | PASS; canonical assertions and native trace |
| 20 | Full reset and initial registrations | PASS; same handle, reapproval restores two each |

## Known Issues

1. **Platform console compatibility:** Stock Edge warns that the experimental `tools` Permissions Policy feature is not enabled. Deployed HTML also contains a Cloudflare challenge-platform inline script that the unchanged `script-src 'self'` blocks. These exact message categories are retained in E2E attachments, not solved by weakening security. The native Codex log surface returned no warning/error entries on the three origins. No TLS/CORS errors were observed. Native WebMCP support is proven for the tested Codex runtime, not all browsers.
2. **Public-network readiness:** Initial five-second test assertions expired while canonical-state requests were pending. Bounded readiness assertions now allow twenty seconds, without sleeps/retries; pending plan-change calls have a separate under-ten-second test budget. Measured success is not a latency SLA. The sole application deployment fix was an empty favicon response; no product redesign was needed.
3. **Demo security boundary:** The handle is a bearer reference, sessions are seeded demos rather than real OAuth, Passport expiry is one hour, and HMAC/service keys are shared by trusted demo servers. This is not production multi-user authentication or isolated partner signing. Only fictional data is permitted; production hardening remains outside Phase 2.

## Recommended Phase 3

Review and approve Phase 2 first. If approved, scope NextStep as the next independent partner on the proven top-level/opaque-handle architecture with the same scope, local-session, audit, reset and native WebMCP gates. Do not revisit iframe discovery or redesign BrightEnergy due to hosting convenience. **No NextStep or other Phase 3 feature has been started.**

## Confidence

**High for the bounded fictional demo in the tested Codex runtime.** Supported by repeated deployed E2E, native calls, exact server denial, fresh-context persistence and deterministic reset. Not a production-security or universal browser-compatibility claim.

## Reproducibility

Final deployed application source: `6e44a8dee85b0c0b16a2b3398218be91166f0a7d`. Public versions: Ruvel 3, BrightEnergy 3, CivicAid 2. Later report-only changes do not affect deployed assets.

Machine-readable evidence is retained locally in `artifacts/phase2-deployed-final.json`, including timing annotations and platform-console attachments. Initial attempts had readiness timeouts, then functional passes rejected by the new broad console assertion. ADR-003 records the investigation and narrow classification of platform messages; unexpected application errors still fail. No failed attempt counts toward the final three consecutive passes.

**STOP — waiting for Phase 2 review.**
