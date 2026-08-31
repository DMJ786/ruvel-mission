# Ruvel Mission — judge walkthrough

Start at [Ruvel Mission](https://ruvel-phase1-mission-dhili.jmsd0811.chatgpt.site). Allow about four minutes plus public-network latency. All content is fictional demo data.

## Opening — the Mission Passport

Say: **“I lost my job yesterday. Help me.”**

1. Select **Reset Demo** if a mission is already present, then **Start mission**.
2. Point out the opaque handle in the address bar: it is only a bearer reference. No Passport, approval, audit or mission state is transported in the URL.
3. Approve the Mission Passport. Say: **“Humans delegate outcomes. Sites retain authority. Agents coordinate capabilities.”**

The Passport is authority before execution. Each independent site will still enforce its own session and policy.

## CivicAid — the session is the reference

1. Continue to CivicAid and show its two native tools.
2. Invoke `check_eligibility({})`, then `prepare_support_claim({})`.
3. Point out that no name, date of birth, address or identifier was supplied. Say: **“The session is the reference.”**
4. The estimate, citizen and prepared claim are fictional; the claim is not submitted. Return to Ruvel and show CivicAid **COMPLETE**.

## BrightEnergy — the signature moment

1. Continue to BrightEnergy. Show exactly two initial native tools: `get_account_summary` and `apply_hardship`. `change_plan` is absent.
2. Invoke both tools. A direct plan-change request before grant is denied server-side with `MISSION_SCOPE_DENIED`.
3. Select **Grant change_plan — this mission only**. Show the actual native registration count change live from **2 → 3**. Say: **“Permission isn't a prompt. It's whether the capability exists.”**
4. Invoke `change_plan({plan: "saver_flex"})`. It returns `awaiting_approval` quickly; the plan has not changed.
5. Use the separate human approval control. This UI click simulates the human role.
6. Continue with `change_plan({approvalId})`. Repeating the continuation is idempotent. Return to Ruvel and show BrightEnergy **COMPLETE**.

## NextStep — keep moving

1. Continue to NextStep and show exactly `register_profile` and `match_roles`.
2. Invoke `register_profile({})`, then `match_roles({limit: 3})`.
3. Show the active profile and three **DEMO OPPORTUNITY** cards. No application is submitted and no external job API is called. Return to Ruvel.

## Completion — the Mission Receipt

1. Show all three organisations **COMPLETE** and select **Complete Mission**.
2. Open **View Mission Receipt**.
3. Show the canonical metrics: three organisations, three complete outcomes, recorded tool actions, authority decisions, elapsed time and the qualified identity-argument count.
4. Show BrightEnergy's authority history from initially unavailable, through the mission-only grant and independent human approval, to completion.
5. Show the three organisation outcomes and human-readable mission timeline. The technical audit is deliberately secondary and closed by default.
6. Point out the masked bearer handle and the privacy qualification. The Receipt does not claim that the AI saw no personal data or that data never left a site.

Close with: **“Passport before execution. Receipt after execution.”**

## Recovery and reset

- If a partner page is refreshed, use its normal **Return to Ruvel** control; the mission handle is preserved.
- If a tool reports that the Passport needs approval, return to Ruvel and approve it.
- If a mission is incomplete, the completion error names the organisations still needed.
- **Reset Demo** is the clean recovery path. It clears all three outcomes, the BrightEnergy grant and approvals, completion and Receipt; a fresh Passport approval is required.
- Do not use a pre-credential-rotation mission. It is intentionally stale and rejected.
