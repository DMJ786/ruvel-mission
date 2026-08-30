# WebMCP Runtime Spike

> Status: **IN PROGRESS — runtime results are intentionally blank until observed.**

Environment:
- Date: 2026-08-30 (Australia/Sydney)
- Browser: Pending runtime test
- ChatGPT environment: Codex desktop built-in browser; exact version pending inspection
- Hub URL: `https://hub.localhost:4173`
- Partner URL: `https://partner.localhost:4174`

## T1 — Native iframe visibility

Result: PENDING

Evidence: Pending runtime test.

Observed behaviour: Pending runtime test.

Implication: Pending runtime test.

## T2 — Cross-origin `executeTool`

Result: PENDING

Evidence: Pending runtime test.

Observed behaviour: Pending runtime test.

Implication: Pending runtime test.

## T3 — Long-running human approval

Result: PENDING

Evidence: Pending 60-second and 120-second runtime tests.

Observed behaviour: Pending runtime test.

Implication: Pending runtime test.

## T4 — Live tool surface changes

Result: PENDING

Evidence: Pending registered → unregistered → registered runtime test.

Observed behaviour: Pending runtime test.

Implication: Pending runtime test.

## T5 — Confirmation behaviour

Result: PENDING

Evidence: Pending `read_probe`, `write_probe`, and `slow_tool` calls.

Observed behaviour: Pending runtime test.

Implication: Pending runtime test.

## T6 — Cross-origin access

Result: PENDING

Evidence: Pending runtime test.

Observed behaviour: Pending runtime test.

Implication: Pending runtime test.

# Recommended Architecture

Branch: PENDING

Reason: Phase 0 runtime evidence has not yet been collected.

# Known Limitations

- Official OpenAI documentation states that the built-in browser currently does not discover tools registered inside same-origin or cross-origin iframes. This is a documentation baseline, not a substitute for the requested runtime test.
- WebMCP is an evolving proposal. This harness uses the current AbortSignal-owned registration lifecycle rather than the removed `unregisterTool()` API.

# Next Step

Run T1–T6 in the ChatGPT built-in browser, record exact evidence, select one architecture branch, and stop for review.
