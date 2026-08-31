# Phase 2 implementation status

Phase 2 is implemented locally but **not accepted or complete**. Public publishing awaits user confirmation required by the Sites hosting workflow. The existing public Ruvel/BrightEnergy deployments still serve Phase 1; CivicAid has been provisioned privately but not deployed.

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
- Browser test discovery: six tests listed successfully (three BrightEnergy regressions and three complete Phase 2 runs).

## Still required before acceptance

1. User confirmation to update the public Ruvel and BrightEnergy sites and publish CivicAid publicly.
2. Configure the shared Phase 2 signing/service secrets and three canonical origins on all three Sites projects.
3. Publish the exact validated revision, verify real D1 provisioning and trusted HTTPS.
4. Run all six deployed Playwright tests and fix any integration failures.
5. Verify CivicAid and BrightEnergy with the real Codex WebMCP surface (not just the Playwright registration harness), including return-state aggregation and reset.
6. Write the final Phase 2 report with observed results.

## Site references

- Mission project: `appgprj_6a943e512b088191a22e4a74c0c9719c` (existing public Phase 1 URL).
- BrightEnergy project: `appgprj_6a943e5fdd048191a72c5d3e039d1d8c` (existing public Phase 1 URL).
- CivicAid project: `appgprj_6a95723357ec8191abb2b1b3b31474ca` (private, not yet deployed; slug `ruvel-civicaid-dhili`).

No NextStep, receipt visuals, real OAuth, or other Phase 3 work has been built.
