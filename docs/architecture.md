# Ruvel Mission architecture — Phase 2

**One mission carried across independent WebMCP sites.**

Life crosses organisations. Websites don't.

> Humans delegate outcomes. Sites retain authority. Agents coordinate capabilities.
>
> Permission isn't a prompt. It's whether the capability exists.

## Multi-page WebMCP

Ruvel, CivicAid and BrightEnergy are separate top-level HTTPS sites. Each partner owns its registrations, fictional session, interface and server-side policy. The hub never exposes another site's tools. CivicAid is the first mission step; BrightEnergy retains the Phase 1 account, hardship, dynamic grant and two-step approval interaction. NextStep is a non-interactive status label only, not an implemented partner.

The original iframe/Mirror architecture was rejected on Phase 0 runtime evidence: cross-origin frames lacked `document.modelContext`, while top-level registration and execution worked. The observed ~24-second tool-call timeout still requires independent human approval and a later continuation. [The spike history](./webmcp-spike.md) and [Phase 1 report](./phase1-report.md) are preserved.

## Durable Mission State

```text
Top-level site UI / WebMCP
  │ same-origin action: opaque mission handle + minimal tool arguments
  ▼
Partner server ── signed site-local fictional session
  │ authenticated HTTP: resolve canonical record, verify Passport
  ▼
Ruvel mission service ── verify current Passport again
  │ prepared SQL + compare-and-swap revision
  ▼
Sites-managed D1: canonical signed mission + timestamps + revision
```

The hub's logical D1 binding is `DB`. Sites provisions and connects the actual database; no Supabase account or extra service is required. `apps/mission/db/schema.ts` defines the table and `apps/mission/drizzle` holds its generated migration. One record contains the signed Passport, both partner states, BrightEnergy approval records and the central audit. Indexed lookup uses the primary-key handle; no speculative secondary indexes are added.

Navigation contains only `?mission=m_<32 random hexadecimal characters>`. The handle is generated from `crypto.randomUUID()` and has no semantic user information. No Passport, approval, state, audit, disclosure policy, or user data is serialized into URLs. The browser does not persist mission data in local/session storage. Refreshes and new browser contexts resolve the database record again.

Every write uses the current database revision. An atomic `UPDATE ... WHERE id = ? AND revision = ?` prevents lost updates. Conflicting requests receive `MISSION_CONFLICT_RETRY` rather than overwriting data. Partner pages poll every four seconds while visible so scope/reset changes update their actual registration maps. Each action reads fresh canonical state regardless of polling.

## Mission Passport

The HMAC-SHA-256 design is preserved: the canonical state containing the Passport is signed server-side and stored in D1. It is not returned as a browser token. Both partner servers independently verify the canonical signature, mission ID, expiry and current scope before forwarding an action; the hub verifies the latest record again before committing. Public routes reject client-supplied `token`, `passport` or `state` snapshots. Internal resolution requires a separately configured service secret and never exposes the signed record through public responses.

Runtime settings are documented in `.env.example`. Signing/service secrets remain Sites secrets, never `VITE_*` values or hosting metadata. All origins are server-configured, so navigation does not trust arbitrary counterpart origins from query strings.

Initial approved scopes are:

- CivicAid: `check_eligibility`, `prepare_support_claim`.
- BrightEnergy: `get_account_summary`, `apply_hardship`.

BrightEnergy's mission-only grant increments the Passport version and dynamically adds `change_plan`. The count is derived from successful native registrations, not a display constant. Canonical scope is authoritative even if a browser retains a stale registration.

## Site-local session identity

The Phase 2 partner servers issue distinct signed, Secure, HttpOnly, SameSite=Lax demo-session cookies. These identify a deliberately fictional seeded session, not a real user or OAuth login. A cookie issued for BrightEnergy does not authenticate a CivicAid request. CivicAid resolves its masked citizen and records locally; the agent supplies no name, DOB, address, account number, tax identifier or customer ID.

`check_eligibility({})` returns a clearly labelled fictional $782/fortnight estimate. `prepare_support_claim({})` requires a completed eligibility check and authorised employment disclosure. It prepares the five fields actually represented in the form (citizen, residence, employment status, support start, support program) and leaves one declaration for human input. It never submits a claim.

The privacy panel renders actual invocation arguments from redacted audit metadata and sums actual identifier-key counts. The supported claim is: **Identity is resolved from CivicAid's existing signed-in session.** It does not claim that an AI can never see site data.

## Approval and audit

BrightEnergy retains the same two-mode `change_plan` tool: `{plan: "saver_flex"}` returns `awaiting_approval`; a human approval is stored independently; `{approvalId}` completes only after current scope, mission ownership, expiry and human approval checks. Completed actions return the existing success idempotently. Reset creates a new Passport generation so stale approval identifiers cannot collide with new approvals on the same mission handle.

The central audit records real timestamps, server-configured origin, capability, redacted actual arguments, identifier-argument count and a bounded result summary. CivicAid and BrightEnergy events remain together across navigation. Duplicate plan completion does not append a second completion event. Identity-like argument keys are redacted; CivicAid rejects unexpected arguments entirely.

## Reset and migration

Reset replaces both partner states on the existing durable handle: CivicAid unchecked/no claim; BrightEnergy Standard Flex, $146, no hardship, no grant/approvals; initial Passport; a new mission-start audit. Reapproval restores each site's two initial tools. Other open pages observe the reset on the next read/action. Start Mission creates a new handle instead.

Phase 1 fragment snapshots are not silently trusted or imported. Updated clients remove legacy session snapshots and require a new durable mission. Historical Phase 1 transport tests remain, but production workers route only to the durable implementation. The Phase 1 Playwright regression is migrated to opaque-handle transport; the new Phase 2 path is designed to exercise both partners three times.

## Bounded demo limitations

- The unguessable mission handle is a bearer reference, not production user authentication. Only fictional data belongs here; real account binding/access control is out of scope.
- A Passport expires after one hour; its durable record remains, but the demo must reset/reapprove rather than silently extend authority.
- HMAC/service credentials are shared between trusted demo servers. Production key isolation and partner-specific service authorization are future work, not Phase 2 claims.
- This is a compact signed JSON record in D1, not a general event-sourcing platform. Revision conflicts require an explicit retry.

See [ADR-002](./decisions.md) for the storage decision. No NextStep, final receipt visuals, real OAuth or extra scenario is implemented.
