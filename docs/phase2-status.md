# Phase 2 implementation status

**Deployment and validation complete; awaiting user review.** The existing Ruvel/BrightEnergy public URLs now serve Phase 2, and CivicAid is public on its own HTTPS origin. Only fictional demo data is used. See the [Phase 2 report](./phase2-report.md) for the complete results and limitations.

## Completed

- D1-backed canonical signed mission records and generated/inspected SQL migration.
- Opaque mission handles only; no fragment envelope or browser-authoritative state.
- Partner-side current Passport verification plus canonical service verification and atomic revision writes.
- BrightEnergy's original flow preserved, with historical Phase 1 tests retained and a migrated browser regression.
- CivicAid's signed site-local fictional session, two minimal-argument tools, five real prepared form fields plus one human declaration, and computed argument-privacy panel.
- Central cross-origin audit and reset across both partners.
- Updated architecture and ADR-002; Phase 0/1 history preserved.

## Local verification

- Lint: PASS.
- Typecheck: PASS for all app/package/config/e2e projects. Only the mission app skips dependency declaration checks because Drizzle ships optional unrelated database-driver declarations; project source remains strictly typechecked.
- Unit/integration: 27/27 PASS (4 Phase 0, 11 Phase 1, 12 Phase 2). SQL tests close and reopen a file-backed SQLite database, test revision conflicts, current-scope denial, site-cookie isolation, redaction, both partner states and reset.
- Build: PASS for all applications, including the three Phase 2 Sites worker bundles. The hub artifact includes the D1 declaration and generated migration.
- Final deployed E2E: 6/6 PASS, no retries, skips or flaky results. Three consecutive complete Phase 2 runs: 34.200s, 38.762s, 31.540s.
- Native Codex WebMCP: CivicAid tools, BrightEnergy 2→3 live registration, asynchronous approval, idempotent completion, return-state aggregation and reset verified.

## Review status

Public deployment was explicitly approved. Server-only secrets and canonical origins are configured, all three deployments succeeded, and fresh-context checks verified durable D1 state. Browser consoles were checked on all origins. Stock Edge's experimental-tools warning and the CSP-blocked hosting-injected Cloudflare script remain documented compatibility caveats; security was not weakened. ADR-003 records these findings, the bounded network readiness allowance, and the minimal favicon response fix.

Waiting for user review of the final report. No Phase 3 implementation is authorized by these results.

## Site references

- Mission project: `appgprj_6a943e512b088191a22e4a74c0c9719c` (existing public Phase 1 URL).
- BrightEnergy project: `appgprj_6a943e5fdd048191a72c5d3e039d1d8c` (existing public Phase 1 URL).
- CivicAid project: `appgprj_6a95723357ec8191abb2b1b3b31474ca` (public; slug `ruvel-civicaid-dhili`).

No NextStep, receipt visuals, real OAuth, or other Phase 3 work has been built.
