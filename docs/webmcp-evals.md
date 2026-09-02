# WebMCP ecosystem validation

Validated on 2 September 2026 against the frozen public Ruvel Mission deployment and its checked-in tool-surface snapshots. No product code, tool description, schema, registration rule or deployed architecture was changed during this work.

## Tooling

- GoogleChromeLabs [`webmcp-evals`](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/webmcp-evals) version `0.0.4`, source commit `97e6fbe83fc3f2e3c6df2198b962dd2ad59cb924`
- Gemini `gemini-3.5-flash`
- Direct `gemini` backend for atomic, state-aware selections
- Official multi-step `vercel` backend with the same Gemini model for BrightEnergy trajectories that permit a preliminary read-only account check
- Chrome 152 with the CLI's `--enable-features=WebMCP` launch flag for deployed smoke execution

The local security product's certificate chain is trusted by Windows but not by Node's bundled CA set. Commands therefore used Node's `--use-system-ca` option. TLS verification remained enabled; no certificate error was ignored.

The configured Gemini credential was loaded only from the ignored local environment. It was not printed, copied into a command, committed or written to an eval report. A post-run scan found zero credential-name or Gemini-key-pattern hits in the four final JSON reports.

## Registered deployed surfaces

The official CLI's Puppeteer WebMCP runtime discovered these public registrations:

| Surface | Tools | Input schema and annotations |
| --- | --- | --- |
| CivicAid | `check_eligibility`, `prepare_support_claim` | Both reject additional properties and take `{}`. Eligibility is read-only; claim preparation is not. |
| BrightEnergy before grant | `get_account_summary`, `apply_hardship` | Summary takes `{}` and is read-only. Hardship requires `{program: "temporary_relief"}` and is not read-only. `change_plan` is absent. |
| BrightEnergy after grant | `get_account_summary`, `apply_hardship`, `change_plan` | The first two remain unchanged. `change_plan` accepts exactly one of `{plan: "saver_flex"}` or `{approvalId: string}` and is not read-only. |
| NextStep | `register_profile`, `match_roles` | Registration takes `{}` and is not read-only. Matching accepts optional integer `limit` from 1–3, defaults to 3 and is read-only. |

This independently reproduced BrightEnergy's deployed **2 → 3** registration transition. The pre-grant schema supplied to the model contains no `change_plan`, so the model cannot select or call that capability. A request to move plans produced only the available read-only `get_account_summary` fallback.

The runtime mapped the source annotations to its inspector representation as `readOnly: true|false` and `untrustedContent: false`.

## Deployed deterministic execution

The CLI's no-model `smoke` mode opened fresh Chrome pages on the real HTTPS partner origins and executed the expected native WebMCP calls against one isolated fictional Mission.

| Surface | Cases | Passed steps | Result highlights |
| --- | ---: | ---: | --- |
| CivicAid | 2 | 3/3 | Eligible with fictional `$782` estimate; claim prepared but not submitted; five prepared fields and one human field. |
| BrightEnergy before grant | 2 | 2/2 | Standard Flex summary and `temporary_relief` activation. |
| BrightEnergy after grant | 3 | 3/3 | Three tools discovered; plan request returned `awaiting_approval`. |
| NextStep | 2 | 3/3 | Fictional profile registered; three demo roles returned. |
| **Total** | **9** | **11/11** | **No execution failures.** |

The tenth fixture is the pre-grant absence case. It is intentionally a selection/surface test rather than a smoke execution because smoke mode requires a concrete tool call.

## Natural-language tool-selection evals

Ten realistic cases are stored in [`evals/webmcp`](../evals/webmcp). Dependent actions use prior function-call and function-response messages to represent the real prerequisite state rather than asking the model to assume it. BrightEnergy permits an optional read-only summary around consequential writes while still requiring the intended write tool and exact arguments.

| Case | Selected trajectory | Arguments | Result |
| --- | --- | --- | --- |
| CivicAid eligibility | `check_eligibility` | `{}` | PASS |
| CivicAid claim after positive eligibility | `prepare_support_claim` | `{}` | PASS |
| BrightEnergy account summary before grant | `get_account_summary` | `{}` | PASS |
| BrightEnergy hardship before grant | `apply_hardship`, optional `get_account_summary` | `{program: "temporary_relief"}`, `{}` | PASS |
| BrightEnergy plan request before grant | `get_account_summary` only; `change_plan` unavailable | `{}` | PASS |
| BrightEnergy account summary after grant | `get_account_summary` | `{}` | PASS |
| BrightEnergy hardship after grant | `apply_hardship`, optional `get_account_summary` | `{program: "temporary_relief"}`, `{}` | PASS |
| BrightEnergy Saver Flex request after grant | `change_plan`, optional `get_account_summary` | `{plan: "saver_flex"}`, `{}` | PASS |
| NextStep profile registration | `register_profile` | `{}` | PASS |
| NextStep three-role match after registration | `match_roles` | `{limit: 3}` | PASS |

Final result: **10/10 cases passed, 0 failed, 0 errors**. The CLI reconciled **13/13 expected and permitted tool-call steps**, including optional read-only account summaries. Every required tool name and constrained argument matched exactly.

One NextStep attempt encountered a transport-level `fetch failed` before a tool call. A single clean rerun passed both NextStep cases 2/2; the failed attempt is retained in the temporary local evidence and was not treated as a product result.

## Audit findings

- Tool names are specific verb–noun capabilities rather than page-control primitives.
- Empty schemas are appropriate where each partner resolves the fictional person from its own signed-in site session.
- All schemas reject unexpected properties.
- Read annotations correctly distinguish answers from actions.
- `change_plan` is structurally absent before mission-only authorization and present afterward.
- Consequential plan change remains a request for independent human approval, not autonomous completion.
- No actual tool-contract defect was found; no product change was made.
- A known hosting/runtime CSP console message reports a blocked inline script. It did not prevent registration or execution and is not a WebMCP contract failure.

Nekuda WebMCP Workbench was not installed or run in this pass, so no Workbench audit score is claimed. Installing that browser extension still requires explicit action-time approval. Discovery, schema inspection and execution evidence above came from the official GoogleChromeLabs CLI runtime.
