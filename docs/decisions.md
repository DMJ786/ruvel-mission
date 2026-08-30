# Architecture decisions

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
