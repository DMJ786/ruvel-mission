# Ruvel Mission

**Say it once.**

Life crosses organisations. Websites don't.

Ruvel Mission is a fictional WebMCP demonstration of one human outcome carried across independent websites. The agent coordinates CivicAid, BrightEnergy and NextStep; each site keeps its own session, policy, tools and authority. Ruvel issues a bounded Mission Passport before work begins and derives a retainable Mission Receipt from canonical durable state after every organisation is complete.

> Humans delegate outcomes. Sites retain authority. Agents coordinate capabilities.

## Public demo

Start at [Ruvel Mission](https://ruvel-phase1-mission-dhili.jmsd0811.chatgpt.site).

- [CivicAid](https://ruvel-civicaid-dhili.jmsd0811.chatgpt.site)
- [BrightEnergy](https://ruvel-phase1-brightenergy-dhili.jmsd0811.chatgpt.site)
- [NextStep](https://ruvel-nextstep-dhili.jmsd0811.chatgpt.site)

All people, identifiers, accounts, claims, amounts, employment information and opportunities are fictional demo data. Do not enter real personal information.

## What the demo proves

- WebMCP works at each partner's top-level HTTPS origin.
- Each site exposes only the tools currently authorised for that mission.
- BrightEnergy changes its actual registered tools from two to three after a human grants mission-only scope: **permission isn't a prompt; it's whether the capability exists.**
- Long human approval is split into a fast `awaiting_approval` response, an independent approval, and an idempotent continuation.
- CivicAid and NextStep resolve the fictional citizen from their own signed-in sessions: **the session is the reference.**
- Canonical mission state and audit survive top-level navigation and a fresh browser context.
- The final Receipt is computed from that canonical record, not a presentation-only counter.

## Judge path

Use the short [judge walkthrough](docs/judge-script.md). The normal path is:

1. Start a mission and approve the Passport.
2. Complete CivicAid with `check_eligibility({})` and `prepare_support_claim({})`.
3. Complete BrightEnergy, showing the two-to-three tool registration change and separate human approval.
4. Complete NextStep with `register_profile({})` and `match_roles({limit: 3})`.
5. Return to Ruvel, complete the mission and open the Mission Receipt.

Reset Demo clears all three partner outcomes, grants, approvals, completion and Receipt on the same durable handle, then requires a fresh Passport approval.

## Architecture

Ruvel and the three partners are separate Sites-hosted applications and HTTPS origins. Navigation carries only an opaque random `?mission=m_…` bearer handle. Partner servers resolve signed site-local fictional sessions, authenticate service-to-service calls to Ruvel, verify the current Passport and commit with compare-and-swap revision checks. Ruvel stores the canonical signed state and central audit in its Sites-managed D1 binding.

The [architecture note](docs/architecture.md) explains the trust boundaries, dynamic registration, approval protocol, durable state and Receipt derivation. [Architecture decisions](docs/decisions.md) preserve the evidence behind the top-level multi-page model.

## Repository

```text
apps/mission          Ruvel hub, D1 worker and Mission Receipt
apps/civicaid         Benefits-support partner
apps/brightenergy     Energy partner and dynamic-authority interaction
apps/nextstep         Employment-support partner
packages/mission-core Shared state, policy, receipt and server logic
e2e                   Deployed golden-path and regression tests
docs                  Architecture, evidence, reports and judge guide
```

## Local development

Requirements: Node.js 22+ and pnpm 11.

```bash
pnpm install
pnpm dev
```

Copy `.env.example` only when configuring a compatible server runtime. Keep real signing and service credentials in server-side hosting secret bindings; never use `VITE_*` variables for them. Local Vite previews show the interfaces but do not emulate the production D1/API runtime.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

The Playwright suite targets deployed origins, runs with zero retries and distinguishes its browser contract harness from the separate native WebMCP proof in the Codex browser. Phase reports record the observed timings and bounded platform limitations.

## Security and privacy boundaries

- The mission handle is an unguessable bearer reference, not production authentication.
- Partner cookies and all demo records are fictional and purpose-separated.
- Secrets remain server-only and are scanned across source, builds and test evidence.
- Receipt privacy metrics are derived only when invocation metadata is complete; otherwise the UI says **Not recorded**.
- “Zero identity-bearing arguments” means identity was not supplied in recorded tool arguments. It does not mean an AI saw no personal data or data never crossed a boundary.
- This hackathon demo is not a government, energy or employment service and calls no external partner API.

## Scope

The accepted demo deliberately avoids OAuth, production identity, additional partners, analytics, voice, external data integrations and generalized orchestration infrastructure. The product story is Passport before execution, independent site authority during execution, and Receipt after execution.

## Licence

[MIT](LICENSE)
