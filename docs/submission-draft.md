# Project name

Ruvel Mission

# Tagline

Say it once.

# One-line description

Ruvel Mission carries one human outcome across independent WebMCP websites while each site retains control of its own session, policy, data and capabilities.

# Problem

Life events cross organisational boundaries, but websites do not. Someone who loses work may need benefits support, energy hardship protection and employment help. Today that person becomes the integration layer: repeating context, finding the right workflow and carrying state between services.

# Solution

Ruvel turns one intent—“I lost my job yesterday. Help me.”—into a durable Mission. A Mission Passport gives bounded starting authority. The agent visits three independent top-level sites and uses the native tools each site chooses to expose. Ruvel tracks canonical progress and produces a Mission Receipt after every required outcome is complete.

The pattern is:

**Humans delegate outcomes. Sites retain authority. Agents coordinate capabilities.**

# Why WebMCP

WebMCP is the product boundary, not a decorative integration. CivicAid, BrightEnergy and NextStep each register real typed tools at their own top-level HTTPS origin. Each partner owns its tool descriptions, input schemas, session, policy and server enforcement.

BrightEnergy demonstrates why that matters. `change_plan` is not registered initially and direct pre-grant execution is denied server-side. After a human grants mission-only scope, the actual native registration changes live from two tools to three. Permission changes the capability surface itself: **permission isn't a prompt; it's whether the capability exists.**

NextStep's `match_roles` also exposes a read-only annotation. The final architecture uses top-level WebMCP navigation because the Phase 0 runtime did not provide usable cross-origin iframe `document.modelContext`.

# Human + agent collaboration

The human delegates an outcome and approves a bounded Passport. The agent coordinates routine actions across sites. Sites keep enforcement authority. BrightEnergy then separates capability grant from approval of the consequential plan change: the agent receives `awaiting_approval`, the human approves independently, and a later continuation completes idempotently.

The result is collaboration without pretending that agent intent overrides organisational policy or human consent.

# Technical implementation

Ruvel, CivicAid, BrightEnergy and NextStep are four separate Sites-hosted HTTPS applications. Navigation carries only an opaque random Mission handle. Each partner resolves its own purpose-separated signed fictional session, verifies the current Passport, and makes authenticated service-to-service calls to Ruvel.

Ruvel stores one signed canonical Mission document in a Sites-managed D1 binding. Writes use compare-and-swap revisions to prevent lost updates. The document contains Passport scopes, three partner states, BrightEnergy approval records, completion state and a central redacted audit.

The TypeScript monorepo includes shared server/policy logic, four deployable workers, unit/integration tests and deployed Playwright paths. The deployed contract suite is kept distinct from the separate native WebMCP browser proof.

# Mission Passport

The Mission Passport is authority before execution. It starts with two tools per partner and required fictional disclosures. It is HMAC-signed server-side, stored with canonical state and verified by every partner. It is not transported as a browser token or URL snapshot.

BrightEnergy's later `change_plan` grant is scoped to one Mission and advances the Passport version. A stale browser registration cannot bypass canonical server policy.

# Dynamic capability authority

BrightEnergy initially exposes exactly:

- `get_account_summary`
- `apply_hardship`

`change_plan` is absent. A separate human grant makes it available, and the real native tool count changes 2 → 3 without navigation. Calling it requests Saver Flex but does not change the plan. An independent human approval and idempotent continuation are still required.

This is the submission's signature moment because it makes authority observable in the tool surface, not only in explanatory copy.

# Privacy / session identity

CivicAid and NextStep resolve the fictional citizen from their own signed-in sessions. CivicAid's tools take `{}`; NextStep registration takes `{}` and matching accepts only a bounded `limit`. The agent does not supply names, addresses, dates of birth or account identifiers as tool arguments.

The qualified product statement is: **the session is the reference.** The Receipt reports zero identity-bearing arguments only because all seven recorded invocation records contain valid redacted metadata and identifier counters. This does not claim that an AI saw no site data or that data never left a site.

# Mission Receipt

The Mission Receipt is accountability after execution. Ruvel derives it from signed D1 state and the de-duplicated canonical audit only after CivicAid, BrightEnergy and NextStep are complete.

The accepted golden path shows:

- 3 organisations
- 3 / 3 complete
- 7 recorded tool actions
- 3 authority decisions
- 0 identity-bearing arguments in recorded tool invocations
- 20 canonical audit events

It also shows actual fictional outcomes, elapsed time, BrightEnergy's authority history and a human-readable timeline. The bearer handle is masked and technical audit is secondary.

# Architecture

The journey is top-level and multi-page:

Ruvel → CivicAid → Ruvel → BrightEnergy → Ruvel → NextStep → Ruvel → Receipt.

Partners retain their own sessions and native tools. Ruvel owns Mission coordination and canonical D1 state. Server-configured origins and authenticated service calls form the trust boundary. No Mission state, Passport or approval state travels in URL fragments.

Full diagram and trust-boundary notes: `docs/architecture.md`.

# What we learned from Phase 0

The original concept tried to embed a partner and discover its WebMCP tools cross-origin. In the tested runtime, top-level `document.modelContext` registration and execution worked, but the cross-origin iframe did not expose the required runtime—even with the expected policy configuration.

We followed the evidence and adopted top-level navigation rather than weakening browser security or faking a bridge. Phase 0 also exposed a practical tool-transport timeout, which shaped BrightEnergy's quick pending response and later continuation.

# Challenges

- Proving actual dynamic registration rather than only changing UI copy.
- Preserving independent site sessions and server authority across top-level navigation.
- Keeping human approval independent without holding a tool call open past transport timeout.
- Moving from an early portable envelope to durable D1 state without redesigning the proven partner flow.
- Rotating shared demo credentials across four deployments while intentionally rejecting old Passports.
- Deriving useful privacy and Receipt metrics without inventing timestamps or overstating what the audit records.

# Impact / future potential

Ruvel demonstrates a reusable interaction pattern for outcomes that span independent organisations: portable intent, bounded site-owned capability, human decision points and accountable completion.

Potential future work includes production identity, partner-specific credentials and stronger account binding. We do not claim production adoption, live partner integrations or universal browser support.

# Public demo

Start here: [Ruvel Mission](https://ruvel-phase1-mission-dhili.jmsd0811.chatgpt.site)

- [CivicAid](https://ruvel-civicaid-dhili.jmsd0811.chatgpt.site)
- [BrightEnergy](https://ruvel-phase1-brightenergy-dhili.jmsd0811.chatgpt.site)
- [NextStep](https://ruvel-nextstep-dhili.jmsd0811.chatgpt.site)

All identities, accounts, amounts, claims, employment information and opportunities are fictional demo data.

# GitHub repository

[github.com/DMJ786/ruvel-mission](https://github.com/DMJ786/ruvel-mission)

# Video

**PLACEHOLDER — final public video URL not yet recorded or published.**

# Testing / validation

- 51 / 51 unit and integration tests
- lint, workspace/root typecheck and production build passed
- 12 / 12 committed deployed E2E cases passed
- three consecutive final Receipt paths with one worker and zero retries
- one complete native WebMCP journey across all three partners
- actual BrightEnergy 2 → 3 registration, independent approval and idempotent continuation
- fresh-browser-context D1 durability
- 20 unique audit events and full three-partner reset
- clean native warn/error consoles across all four origins
- source/build/browser/network/audit/E2E secret-fingerprint scan

Exact evidence and timings: `docs/phase4-report.md`.

# Security/demo boundaries

This is a fictional hackathon demonstration, not a production government, energy or employment service. The opaque Mission handle is a bearer reference, not production authentication. Sessions are seeded fictional accounts. Trusted demo servers share rotated server-only credentials. No external partner API is called. Native WebMCP is proven only in the tested Codex runtime. The privacy metric describes recorded tool arguments, not everything an AI or website could observe.

# Credits

Built as Ruvel Mission for the WebMCP hackathon. Product engineering, interaction design, testing and submission preparation were completed collaboratively with OpenAI Codex. Released under the MIT Licence.

# Internal judging criteria mapping

This section is for submission preparation and can be shortened when entering Devpost.

## WebMCP Leverage

- real native tools on three independent top-level sites
- dynamic BrightEnergy registration from two to three tools
- `readOnlyHint` on NextStep matching and CivicAid eligibility
- site-owned schemas, sessions, policy and capability enforcement
- evidence-led top-level multi-page journey instead of an iframe bridge

## Execution

- Ruvel plus three public HTTPS partner origins
- 51 unit/integration tests and 12 deployed E2E cases
- three consecutive zero-retry final paths
- deterministic Reset Demo and fresh-context D1 durability
- canonical Mission Receipt and 20-event audit
- four-origin native console checks and credential-exposure validation

## Potential Impact

One human outcome can span independent organisations without centralising all their sessions, data or authority. The pattern could support coordinated, accountable assistance in other multi-organisation life events. No production adoption is claimed.

## Creativity & Ambition

- Mission Passport as bounded authority before execution
- runtime capability authority expressed as actual tool availability
- site-local session identity rather than repeated identity arguments
- one durable Mission across independent WebMCP sites
- Mission Receipt as accountability after execution
