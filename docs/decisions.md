# Architecture decisions

## ADR-002: Move Phase 1 portable envelope to durable mission storage

- Status: Accepted for Phase 2
- Date: 2026-08-31

Phase 1's signed portable envelope minimized infrastructure while proving top-level WebMCP, actual capability registration, server scope denial, and asynchronous approval. Its growing URLs, replayable snapshots, lack of centralized reset, and potential lost updates make it unsuitable for the two-partner journey.

Phase 2 stores the canonical signed state in a Sites-managed D1 database owned by the hub. Navigation carries only a cryptographically random opaque `mission` handle. Partners resolve canonical state through authenticated server-to-server HTTP requests, verify its signature and current scope, and commit using compare-and-swap revisions. A conflict returns an explicit retry error rather than overwriting another partner. The browser holds only a rendered snapshot; it cannot submit a Passport or authoritative state.

This uses the deployment platform's existing persistence support rather than introducing Supabase credentials or another service. D1 is hidden behind one small store helper. BrightEnergy's interaction and approval reducers remain unchanged. CivicAid resolves a fictional citizen from a signed site-local demo-session cookie, never from agent identity arguments. The demo remains explicitly fictional; the opaque handle is a bearer reference, not production user authentication.

The Phase 1 transport is retained only in historical unit tests, not routed by production workers. Existing fragment sessions must start a new durable demo mission. Reset updates the same durable handle so other open partner pages observe the reset on their next read/action. No NextStep implementation is part of this decision.

## ADR-001: Use top-level multi-page WebMCP partners

- Status: Accepted
- Date: 2026-08-31
- Decision owner: Ruvel Mission

### Context

Phase 0 tested the original Mirror concept: a Ruvel hub embedding an independent partner origin and attempting cross-origin WebMCP discovery and execution. The tested ChatGPT/Codex browser runtime established that:

- WebMCP registration and invocation work when the participating site is the top-level document.
- `document.modelContext` is unavailable inside the tested cross-origin iframe, including with the expected Permissions Policy and `allow="tools"` configuration.
- Cross-origin iframe tool discovery and execution therefore do not provide a viable product path in the tested runtime.
- Top-level registration can be changed dynamically by aborting and registering tools again; the Site Tools surface follows the new registrations.
- Agent-facing tool calls time out at roughly 24 seconds, so a tool call cannot remain open while waiting for a human approval.

The detailed evidence and retained test history remain in [webmcp-spike.md](./webmcp-spike.md).

### Decision

Ruvel Mission will be a top-level, multi-page WebMCP journey: **one mission carried across independent WebMCP sites**.

The Ruvel hub owns mission creation, the Mission Passport, cross-organisation progress, navigation, audit aggregation, and the eventual Mission Receipt. Each partner site becomes the top-level document while the agent interacts with that organisation and owns its authenticated fictional session, WebMCP registrations, UI, data, policy, and capability enforcement.

For Phase 1, shared state will use a signed portable mission envelope. The hub issues a compact token containing non-PII Passport scopes, BrightEnergy action state, approvals, and audit events. Both origins independently verify its HMAC signature and expiry. Navigation transfers it in the URL fragment; each page moves it immediately into session storage and removes it from the address bar. State-changing partner requests send the current envelope to the partner server, which verifies scope and approval before returning a newly signed envelope.

This is the smallest reliable implementation for two independent origins: deterministic, resettable, server-authoritative, and free of database or identity infrastructure that Phase 1 does not need.

Plan changes use an asynchronous two-step protocol. The first `change_plan` invocation creates a pending approval and immediately returns `awaiting_approval`. A separate human action records approval. A later invocation of the same tool with the approval identifier completes the action idempotently.

### Consequences

- A partner never attempts to expose tools through another origin's iframe.
- The real registered tool set is derived from Passport scope at the active top-level site.
- The initial BrightEnergy tool surface contains only `get_account_summary` and `apply_hardship`; granting the mission-only plan-change scope dynamically adds `change_plan`.
- Partner servers remain authoritative even when a browser registration exists.
- The signed envelope is suitable for the bounded Phase 1 demo but is not a substitute for durable multi-device storage in a later production phase.
- CivicAid, NextStep, the final Mission Receipt, and a generalized partner SDK remain outside Phase 1.

### Rejected alternative

The iframe/Mirror architecture is rejected for this runtime based on observed Phase 0 behavior. It will not be restored unless the runtime contract materially changes and a new spike proves cross-origin iframe discovery and invocation end to end.
