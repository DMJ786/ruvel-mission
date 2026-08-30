# Ruvel Mission architecture

## Product frame

**One mission carried across independent WebMCP sites.**

Life crosses organisations. Websites don't. Ruvel Mission carries one bounded human intent between independent agent-ready sites while each site retains authority over its own data, policy, UI, and actions.

> Humans delegate outcomes. Sites retain authority. Agents coordinate capabilities.

> Permission isn't a prompt. It's whether the capability exists.

## Phase 1 topology

```text
ChatGPT
   │ WebMCP (top-level document only)
   ▼
Ruvel Mission hub
   │ signed mission envelope in a one-time URL fragment
   ▼
BrightEnergy
   │ independently verified Passport scope and approval
   ▼
Ruvel Mission hub
```

The Phase 1 deployment contains two genuinely independent HTTPS origins:

- Ruvel Mission creates and resets the mission, issues and approves the Mission Passport, navigates to the partner, and renders returned progress and the aggregated audit.
- BrightEnergy has its own deterministic fictional authenticated session, account UI, policy enforcement, server actions, and top-level WebMCP registrations.

CivicAid, NextStep, the final Mission Receipt, and a generalized partner SDK are intentionally absent.

## Shared mission state

Phase 1 uses a signed portable mission envelope rather than a database. The envelope contains no real PII. It stores:

- Passport identity, version, issue and expiry timestamps;
- approved BrightEnergy capability scopes;
- permitted and forbidden disclosure categories;
- BrightEnergy plan and hardship state;
- pending, approved, and completed approval records;
- ordered audit events with real timestamps.

Each server uses the same privately configured HMAC-SHA-256 secret and independently verifies the signature and expiry. The token travels only in the URL fragment during navigation. Client code immediately copies it to origin-scoped session storage and removes the fragment from browser history. Subsequent state transitions are same-origin server requests that return a freshly signed envelope.

This bounded approach is deterministic, resettable, and sufficient for the Phase 1 single-device demo. A later production phase should replace the portable envelope with durable server storage when multi-device recovery, revocation, larger histories, or concurrent organisation updates become requirements.

## Passport and tool registration

The approved initial Passport grants exactly:

- `get_account_summary`
- `apply_hardship`

BrightEnergy verifies the envelope before registering anything. Its registration controller derives the desired set directly from `passport.scopes.brightenergy`. Granting `change_plan` increments the Passport version and returns a newly signed envelope. BrightEnergy observes the scope change and registers the tool immediately. The visible capability count is the size of the successful registration map, not display-only state.

Every state-changing server route verifies the Passport again. A direct plan-change request without scope receives HTTP 403 with `MISSION_SCOPE_DENIED`, even if a client attempts to bypass the interface.

## Human approval protocol

`change_plan` is one small, two-mode tool:

1. `{ plan: "saver_flex" }` verifies scope, writes a pending approval, displays the comparison, and immediately returns `awaiting_approval` with an approval identifier.
2. The human clicks Approve in BrightEnergy. This records `human_approved` independently of the completed agent call.
3. `{ approvalId }` verifies mission ownership, expiry, scope, human approval, and completion status before applying the plan.

Completion is idempotent: repeating the continuation for a completed approval returns the existing success without applying the action or writing another completion event.

## Audit model

Events are appended by the authoritative state transition that performs the work. Phase 1 records mission start, Passport approval, tool invocation and completion, capability grant, approval request, and human approval. The carried signed state makes the same ordered trace visible at both sites and after returning to the hub.

## Reset

Reset issues a new mission envelope with a new mission identifier, Standard Flex at $146/month, no hardship protection, no approvals, the two base scopes only, and a new `mission_started` event. Old signed state is not reused by the active session.

## Rejected Mirror architecture

The original design composed three origins inside one tab and attempted to expose partner tools through cross-origin iframes. Phase 0 rejected that architecture based on runtime evidence: the partner frame did not receive `document.modelContext`, cross-origin discovery/execution did not work, and only the top-level document provided reliable WebMCP behavior. Phase 0 also established that dynamic top-level registration works and that agent-facing calls time out near 24 seconds, motivating the asynchronous approval protocol.

The retained evidence is in [webmcp-spike.md](./webmcp-spike.md), and the binding decision is in [decisions.md](./decisions.md).
