# Ruvel Mission — Phase 3 judge walkthrough draft

Working demonstration sequence, not final submission copy or a final-video script.

1. Start at Ruvel: “I lost my job yesterday. Help me.” Reset Demo, start a fresh mission, and approve its initial Passport. Show the opaque mission handle and three independent organisations.
2. Open CivicAid as the top-level site. Discover its two actual WebMCP tools. Invoke `check_eligibility({})`, then `prepare_support_claim({})`. Explain: “The session is the reference.” The fictional citizen comes from CivicAid's signed session, with no identity arguments. Five fields are prepared and one human declaration remains; no real claim is submitted. Return to Ruvel: CivicAid COMPLETE.
3. Open BrightEnergy. Discover exactly two tools, call `get_account_summary({})` and `apply_hardship({})`. `change_plan` is absent; the direct pre-grant request is independently denied by the server. Say: “Permission isn't a prompt. It's whether the capability exists.”
4. The human grants “Change plan — this mission only”. Show the actual Site Tools change from 2 to 3 without navigating. Call `change_plan({plan:"saver_flex"})`; it returns `awaiting_approval`. A separate human click approves. Continue with `change_plan({approvalId})`; repeating continuation is idempotent. Return to Ruvel: BrightEnergy COMPLETE.
5. Open the independently branded NextStep. Discover exactly `register_profile` and `match_roles`. Call `register_profile({})`, then `match_roles({limit:3})`. Show the active fictional profile and three clearly labelled DEMO OPPORTUNITY cards. No extra approval or external job service is needed.
6. Return to Ruvel: all three organisations COMPLETE and MISSION READY TO COMPLETE. Show central audit entries from all three partner origins. Open the same handle in a fresh browser context to demonstrate durable state.
7. Reset Demo: all partner outcomes, grants and approvals clear; fresh Passport approval is required. Reapproval restores two initial tools at every partner.

Close the Phase 3 demonstration with: “Humans delegate outcomes. Sites retain authority. Agents coordinate capabilities.” Stop before final Mission Receipt visuals. All people, identifiers, employment information and amounts are fictional demo data.
