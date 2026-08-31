# Ruvel Mission architecture — Phase 4

**One mission carried across independent WebMCP sites.**

Life crosses organisations. Websites don't.

> Humans delegate outcomes. Sites retain authority. Agents coordinate capabilities.
>
> Permission isn't a prompt. It's whether the capability exists.

## Product and trust boundaries

```text
                         opaque ?mission=m_… navigation
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
  CivicAid HTTPS       BrightEnergy HTTPS       NextStep HTTPS
  own session          own session              own session
  2 native tools       2 → 3 native tools       2 native tools
        │                      │                      │
        └──── authenticated service calls + current Passport ────┐
                                                                  ▼
Ruvel Mission HTTPS ── Passport / progress / completion ── canonical D1 record
        ▲                                                         │
        └──────── Mission Receipt derived from state + audit ─────┘
```

Ruvel, CivicAid, BrightEnergy and NextStep are four separate top-level HTTPS origins. Each partner owns its interface, native WebMCP registrations, fictional signed session and server-side policy. Ruvel owns mission creation, the bounded Passport, cross-organisation progress, central audit, terminal completion and the final Receipt. No site exposes another site's tools.

The original iframe/Mirror architecture remains rejected on Phase 0 runtime evidence: top-level WebMCP registration and execution worked, while the tested cross-origin frame had no usable `document.modelContext`. The top-level journey is Ruvel → CivicAid → Ruvel → BrightEnergy → Ruvel → NextStep → Ruvel. The observed tool-call timeout also requires BrightEnergy approval to be an immediate pending response, independent human action and later continuation. The evidence remains in [the spike history](webmcp-spike.md).

## Durable mission state

```text
Top-level partner UI / native WebMCP
  │ opaque mission handle + minimal capability arguments
  ▼
Partner server ── resolve signed site-local fictional session
  │ authenticated HTTP; verify current signed Passport and scope
  ▼
Ruvel mission service ── verify current record again
  │ prepared SQL + compare-and-swap revision
  ▼
Sites-managed D1 ── signed canonical state, approvals, completion and audit
```

The hub's logical D1 binding is `DB`. One row stores the signed Passport, all three partner outcomes, BrightEnergy approval records, optional completion timestamp and central audit. Phase 4 adds completion inside the existing signed JSON state, so no SQL migration or new persistence service is needed.

Navigation transports only `?mission=m_<32 random hexadecimal characters>`. It contains no Passport, mission snapshot, partner state, approval or audit. The browser does not persist canonical state in local or session storage. Refreshes and fresh browser contexts resolve the D1 record again. The handle is intentionally a bearer reference for fictional demo data, not production authentication.

Every write uses the current database revision. Atomic `UPDATE … WHERE id = ? AND revision = ?` prevents lost updates; a conflict returns `MISSION_CONFLICT_RETRY`. Partner actions always read fresh canonical state. Visible partner pages also poll while active so grants and resets update their actual native registration maps.

## Mission Passport

The Passport is HMAC-SHA-256 signed server-side and retained in D1; it is not returned as a browser token. All three partners independently verify signature, mission ID, expiry and current scope before forwarding an action. Ruvel verifies the latest record again before commit. Internal service calls use a separate server-only secret. Browser routes reject client-supplied Passport or state snapshots.

Initial approved scopes are:

- CivicAid: `check_eligibility`, `prepare_support_claim`
- BrightEnergy: `get_account_summary`, `apply_hardship`
- NextStep: `register_profile`, `match_roles`

BrightEnergy's human mission-only grant increments the Passport version and adds `change_plan`. Its displayed count comes from successful native registrations, not a UI constant. Canonical scope remains authoritative even if a browser has a stale registration.

The shared demo signing and service credentials were rotated across all four deployments in Phase 3. Previously signed missions remain invalid and are neither migrated nor silently re-signed. Credentials remain server-only hosting bindings.

## Site-local sessions and data minimisation

Each partner issues a distinct signed, Secure, HttpOnly, SameSite=Lax fictional demo-session cookie. A partner resolves the fictional citizen and local records from that session; the agent supplies no name, date of birth, address, account/customer number or government identifier.

CivicAid's `{}` calls return a fictional eligibility estimate and prepare, but never submit, a support claim. NextStep's `{}` profile registration and bounded `{limit}` matching return fixed fictional opportunities and submit no application. BrightEnergy retains the proven account, hardship and plan-change interaction.

Invocation audit stores redacted arguments and an `identifierArgumentCount`. The Receipt sums this value only when every counted invocation has complete metadata; otherwise it says **Not recorded**. A zero means no identity-bearing arguments were supplied in those recorded tool invocations. It does not claim the AI saw no site data or that data never crossed a boundary.

## Dynamic authority and approval

BrightEnergy exposes exactly two tools initially. A current mission-only grant makes `change_plan` actually available without navigation. The server still returns `MISSION_SCOPE_DENIED` before grant.

`change_plan({plan: "saver_flex"})` creates a pending approval and returns `awaiting_approval` without changing the plan. A separate human-facing action stores approval independently. `change_plan({approvalId})` completes only after current scope, mission ownership, expiry and approval checks. The continuation is idempotent. This preserves human authority without holding a WebMCP transport open.

## Canonical completion and Mission Receipt

Completion is a hub-only durable transition. It requires an approved current Passport and these canonical outcomes:

- CivicAid eligibility checked and claim prepared
- BrightEnergy hardship active and Saver Flex applied
- NextStep profile active with at least one role match

An incomplete request returns `MISSION_INCOMPLETE` with human-readable blocking organisations. A successful transition stores one timestamp, appends one `mission_completed` event and is idempotent. The completed record is terminal for other partner mutations; Reset Demo is the deliberate recovery path.

The Receipt is never accepted from the client. Ruvel derives it after each canonical read from the signed state, de-duplicated timestamp-ordered audit and server-configured origins. It is returned only when completion and all outcomes remain internally consistent.

Derived evidence includes:

- participating and completed organisations from Passport scopes and actual state
- recorded tool actions from canonical `tool_invoked` records, not audit-row totals
- authority decisions from Passport approval, capability grant and human approval records
- elapsed time from mission start to durable completion
- CivicAid estimate, BrightEnergy saving and NextStep match count from actual canonical results
- BrightEnergy authority history with exact timestamps where the audit contains them
- a human timeline and a secondary allowlisted technical audit

The UI masks the bearer handle and omits approval IDs, session values, raw citizen data and unknown arguments/results. When native registration time is not present in the canonical audit, the authority history says so instead of fabricating a timestamp.

## Audit and reset

The central audit records real timestamps, server-configured origin, capability, redacted arguments, identifier-argument count and bounded result summaries. A complete Phase 4 golden path contains 20 unique events: the accepted Phase 3 journey's 19 plus terminal mission completion. Repeated continuation and completion do not add duplicates.

Reset replaces all partner outcomes, grants and approvals, clears completion and its Receipt, starts a new audit and issues a fresh unapproved Passport generation on the same opaque handle. Reapproval restores each partner's two initial native tools.

## Bounded demo limitations

- Real WebMCP is proven in the tested Codex runtime, not every browser.
- The mission handle is a bearer reference; production user authentication and account binding are out of scope.
- Passport expiry is one hour. The demo resets/reapproves rather than silently extending authority.
- Trusted demo servers share signing/service credentials. Production key isolation and per-partner service authorization remain future work.
- D1 stores one compact signed mission document, not a general event-sourcing platform.
- All identities, accounts, claims, amounts, employment information and opportunities are fictional; no external partner API is called.

See [the decisions](decisions.md), [judge walkthrough](judge-script.md) and latest phase report for evidence and exact deployed results.
