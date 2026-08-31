# PHASE 3 — THREE-ORGANISATION MISSION REPORT

Validation date: 2026-09-01 (Australia/Sydney). **Deployment and validation complete; awaiting user review.** This is not user acceptance. No Phase 4 work is authorised or implemented.

## Public URLs

- [Ruvel Mission](https://ruvel-phase1-mission-dhili.jmsd0811.chatgpt.site) — existing URL preserved; version 4.
- [CivicAid](https://ruvel-civicaid-dhili.jmsd0811.chatgpt.site) — existing URL preserved; version 3.
- [BrightEnergy](https://ruvel-phase1-brightenergy-dhili.jmsd0811.chatgpt.site) — existing URL preserved; version 4.
- [NextStep](https://ruvel-nextstep-dhili.jmsd0811.chatgpt.site) — new independent public HTTPS origin; version 1.

Start at Ruvel and approve a fresh Passport before visiting partners. All four origins opened with trusted HTTPS and no certificate interstitial. Norton, TLS verification, CSP and browser security remained enabled. All users, identifiers, accounts, amounts, claims, employment information and opportunities are fictional. No external government, energy or employment API is called.

## Deployment credential rotation

Two independent cryptographically random 48-byte credentials were generated and configured as server-only Sites secret bindings on all four projects. Every deployment was confirmed successful at its updated environment revision before acceptance testing resumed. Plaintext values were not placed in source, local environment files, build inputs or reports. Only SHA-256 fingerprints were retained locally for exposure checks. No key-versioning, old-key compatibility or migration was added.

**Regression A — PASS:** A freshly approved, still-unexpired pre-rotation control mission was created before replacing the key. After deployment, Ruvel and all three partner origins rejected it with **401 `PASSPORT_INVALID`**. The control was not reset or re-signed. Integration coverage additionally verifies that rejection leaves its stored signed record unchanged and that the old service credential is rejected.

**Regression B — PASS:** The deployed probe first created a clean new mission. Its initial Passport was unapproved and NextStep returned `PASSPORT_NOT_APPROVED`. After fresh approval, CivicAid eligibility, BrightEnergy account summary and NextStep profile registration all succeeded. These actions exercised each partner's current-key verification and authenticated service-to-service resolution/commit calls to Ruvel. The native journey and golden paths start their own fresh missions.

Old D1 rows may remain physically stored, but their old signatures are stale. An explicit reset creates clean initial state and requires new approval; it does not preserve or silently re-sign old outcomes. This is deployment credential maintenance, not a product architecture change; see [the deployment note](./decisions.md).

**Secret-exposure checks — PASS:** Fingerprint scanning covers tracked source and reachable Git history, expanded deployment builds (including base64-embedded assets), browser JavaScript/HTML, browser request URLs/query parameters/headers/bodies, API responses, console messages, canonical audit, and E2E reports/attachments. Diagnostic trace archives were expanded and scanned too, including extensionless response resources. The scanner self-test proves detection of raw, URL-encoded and base64 representations. The final pre-report-commit scan checked **5,751 text files, 234 Git objects and 308 trace archive entries** with no matches. Each golden run independently checked HTML/JavaScript from all four public origins, request/query/console surfaces and canonical audit, attaching `secretLeakCheck: PASS`. These are bounded checks for the new credential values, not a general security certification.

## NextStep WebMCP

**Registered tools:** Exactly `register_profile` and `match_roles`, discovered and executed through native `document.modelContext` in the Codex in-app browser. No injected harness was used for this proof.

**Session resolution:** NextStep resolves its masked fictional citizen, employment context, Sydney preference and immediate availability from its own signed site-local session. Its Secure, HttpOnly, SameSite=Lax cookie is purpose-separated from other partners. Tampered, expired, missing and other-partner cookies are tested. Canonical profile/matches persist in Ruvel D1.

**Tool arguments:** `register_profile({})`, then `match_roles({limit:3})`. Both reject unexpected fields. Matching requires a registered profile, accepts limits 1–3, and advertises `readOnlyHint: true`. It submits no application and changes no employment record; only the derived mission result and audit are persisted. No extra human approval is introduced.

**Results:** Profile ACTIVE; AI Platform Engineer (Sydney · Hybrid), Senior Software Engineer (Sydney · Hybrid), Cloud Engineering Lead (Remote Australia · Remote). Every card says DEMO OPPORTUNITY. Repeating identical successful calls adds no duplicate events.

**Native timings:** Profile registration **5.423s**; role matching **6.233s**, including browser-tool transport overhead.

**Site Tools behaviour:** The actual top-level origin is reported for each tool. Native discovery confirmed exactly two NextStep tools and the read-only annotation. Returning to Ruvel removed partner tools from the active document; reset/reapproval restored the initial surface.

## Three-Partner Mission

- **CivicAid:** Native `{}` calls returned eligibility and a prepared draft with five populated fields and one human declaration, with zero identifier arguments. Ruvel showed COMPLETE.
- **BrightEnergy:** Account summary and hardship passed. Actual registration changed 2→3 after a separate mission-only grant. The native pending response arrived in **9.827s**, without transport timeout; the plan remained Standard Flex while waiting. A separate approval UI click simulated the human role. Continuation completed in **5.565s**, and a repeated continuation returned `idempotent: true`. Ruvel showed COMPLETE.
- **NextStep:** Both native tools passed, no extra approval, three fictional opportunities. Returning to Ruvel showed all three organisations COMPLETE and MISSION READY TO COMPLETE.
- **Fresh-context durability — PASS:** Integration coverage closes/reopens SQLite and resolves all three canonical states. Each of the three final deployed golden runs opened the completed handle in a fresh browser context and verified all three COMPLETE without prior browser storage. Partner re-entry retained CivicAid's claim, BrightEnergy's plan and NextStep's profile/matches.

The native journey used one opaque handle and reached completion with 19 audit events. It was deliberately reset afterward; that handle is not a preserved receipt. Navigation carried only `?mission=m_<32 hexadecimal characters>` and no fragment, Passport, mission snapshot, approval or audit state. The accepted D1 and top-level architecture was extended, not redesigned. BrightEnergy's interaction code changed only its reset message from two partners to three.

## Passport

**NextStep scopes:** `register_profile`, `match_roles` are in the initial canonical Passport alongside CivicAid's two scopes and BrightEnergy's original two. An unapproved Passport, missing scope or missing employment disclosure is denied server-side. No identity arguments establish authority.

**BrightEnergy dynamic grant regression:** `change_plan` is absent initially. The mission-only grant updates canonical scope and actual native registrations without reload; Site Tools reflects the third tool live. Direct pre-grant HTTP denial is asserted independently in deployed E2E. Old signatures do not gain these scopes through any migration.

## Audit

**Total events:** **19** for the complete native journey. NextStep contributes exactly four invocation/completion events. Repeated completion/matching does not duplicate them.

**Origins represented:** Ruvel plus CivicAid, BrightEnergy and NextStep. Canonical entries include origin, capability, timestamp, redacted arguments and bounded result summaries. The UI renders the origin and activity timeline.

**Redaction:** CivicAid and NextStep registration arguments are `{}`; matching retains only `{limit:3}`. Identifier-argument counts are zero for these tools. Known bounded plan/program values remain; identity-like values and continuation identifiers are redacted. No signing/service credential belongs in an audit event.

## Reset

**Native result — PASS:** Same-handle reset cleared all three outcomes and the completion banner, returned the Passport to awaiting approval, and reset audit to one mission-start event. After reapproval, CivicAid had unchecked eligibility/no claim and two native tools; BrightEnergy had Standard Flex/$146/no hardship/no approvals/no `change_plan` and two native tools; NextStep had no registered profile/no matches and two native tools. The browser was then reset again to leave a clean, unapproved mission for review.

## Golden Path

Three consecutive deployed runs, one worker, **no retries, skips or flaky results**:

| Run | Full test duration | Pending response (harness/API) | Result |
| --- | ---: | ---: | --- |
| 1 | 119.364s | 1.695s | PASS |
| 2 | 114.650s | 1.584s | PASS |
| 3 | 92.656s | 5.411s | PASS |

Full-test durations include all three partners, pre-grant server denial, asynchronous approval, duplicate continuation/matching, fresh-context durability, re-entry, complete reset, registration restoration, browser cleanup and exposure checks. Native timings are separate. Suite wall time was 358.495s. All three runs asserted exactly 19 unique audit events and scanned HTML/JavaScript from every public origin. These durations include test instrumentation and cleanup, not just the story's visible user journey.

## Real WebMCP

| Site | Native result | Timings |
| --- | --- | --- |
| CivicAid | Both tools PASS with `{}`; no identity arguments | 4.170s eligibility; 7.298s claim |
| BrightEnergy | Initial two, live 2→3, pending, independent approval, continuation and duplicate PASS | 9.242s summary; 8.449s hardship; 9.827s pending; 5.565s continuation |
| NextStep | Exactly two; registration and read-only matching PASS | 5.423s registration; 6.233s matching |

**Result:** Complete native three-partner journey PASS. Browser automation clicked the separate human-facing approval controls; this is not a claim that the user personally clicked them. Two navigation-control calls timed out before navigation; state was inspected and the clicks were repeated. No native WebMCP operation timed out. Automated Edge contract tests remain separately identified as harness execution, not native evidence.

## Tests

| Gate | Result |
| --- | --- |
| Lint | PASS, including final test utilities |
| Typecheck | PASS: all apps/packages plus root/config/E2E |
| Unit/integration | **40/40 PASS**: 4 Phase 0, 11 Phase 1, 12 Phase 2, 13 Phase 3; includes rotation A/B |
| Build | PASS: all six applications and all four mission/partner workers |
| Deployed E2E | **9/9 PASS** across two final commands: six preserved regressions and three full Phase 3 paths |
| Three consecutive full paths | **3/3 PASS**, one worker, zero retries/skips/flaky results |
| Real native WebMCP | PASS across all three partners, including 2→3 and independent approval |
| Trusted HTTPS | PASS on all four public origins; no certificate-error bypass |
| Secret exposure | PASS on scanned source/build/browser/network/console/audit/E2E surfaces |
| Fresh context / audit / reset | PASS in all three deployed golden runs and corresponding integration tests |

The six-regression command completed in 281.931s with no retries/skips/flaky results. BrightEnergy-only durations: **43.933s / 35.707s / 30.382s**. Two-partner durations: **48.673s / 48.061s / 30.840s**. These final commands cover every committed E2E case; earlier interrupted diagnostic runs are not counted. Node's experimental SQLite warning is local to the integration-test adapter, not deployed D1. The mission project's existing dependency-declaration skip remains limited to unrelated optional Drizzle driver declarations; application source is strictly checked.

## Consoles

| Public origin | Native Codex warning/error log | Deployed Edge classification |
| --- | --- | --- |
| Ruvel | Empty | No unexpected application errors; known platform categories only |
| CivicAid | Empty | No unexpected application errors; known platform categories only |
| BrightEnergy | Empty | No unexpected application errors; known platform categories only |
| NextStep | Empty | No unexpected application errors; known platform categories only |

No native TLS, CORS or Permissions-Policy errors were observed. Stock Edge's previously documented experimental `tools` policy warning and hosting-injected Cloudflare inline-script CSP violation remain narrowly classified platform messages, not silently discarded. Strict CSP/TLS remain unchanged. Unexpected application messages fail the deployed tests.

## Known Issues

1. **Browser/platform compatibility:** Real WebMCP is proven in the tested Codex runtime, not stock Edge or all browsers. Stock Edge emits the known policy/CSP platform categories described above. Security was not weakened to suppress them.
2. **Demo boundaries and latency:** The handle is a bearer reference; partner sessions are seeded fictional accounts, not OAuth. Passports expire after one hour, with shared credentials across trusted demo servers. Native calls measured 4.170–9.827s; public-network latency and browser-control overhead vary. These are not production authentication or latency guarantees.
3. **Validation infrastructure:** The first E2E launch exposed an ESM-loader incompatibility in the new leak scanner; its CLI entry detection was corrected. Diagnostic runs then completed functional assertions but timed out collecting navigation-interrupted response bodies. Waiting for completed transfers alone was insufficient; explicit page cleanup before finalizing the collector resolved it. Diagnostic failures are retained; none count toward the final three passes. An interrupted diagnostic ZIP lacks its central directory; available local-entry contents are recovered in memory for scanning, and it is not acceptance evidence. No deployed application or architecture change was required.

## Recommended Phase 4

After review and explicit approval, build only the final Mission Receipt/light final polish and refine the judge narrative around the proven journey. Do not add another partner, OAuth, APIs, scenario, voice, analytics or a new architecture. The [judge script](./judge-script.md) is a draft only. **No Phase 4 work has begun.**

## Confidence

**High for the bounded fictional demo in the tested Codex runtime.** Supported by deployed old/new-key regressions, native execution across all three partners, 40 unit/integration tests, all nine deployed E2E cases, three consecutive full journeys, fresh-context durability, audit uniqueness and complete reset. This is not a production-security or universal-browser claim.

## Reproducibility

Deployed application source: `6767964631d51497c8e095ab091b2d0bdfffef7e`. Ruvel/BrightEnergy/CivicAid/NextStep versions: **4/4/3/1**. Their applied environment revisions are **3/3/2/1** respectively; revision numbers are per-project counters, not different credential values. Later test-utility and report-only fixes do not change deployed application assets.

Local ignored evidence: `artifacts/phase3-rotation-result.json`, `artifacts/phase3-native-evidence.json`, `artifacts/phase3-three-partner-final.json`, `artifacts/phase3-regressions-final.json`, expanded diagnostic traces, and the fingerprint-only exposure-check file. No plaintext credentials are included in these artifacts.

**STOP — waiting for Phase 3 review. No Mission Receipt/final polish or other Phase 4 work has begun.**
