# Ruvel Mission — final video storyboard

Target runtime: **2:45**. Hard limit: **under 3:00**.

This is a recording plan for the deployed product. It does not authorize fake interactions, product changes or Devpost submission.

## Story in one line

Problem → Mission → Passport → independent WebMCP sites → dynamic authority → human approval → Receipt.

## Shot-by-shot plan

| Time | Screen and action | Narration | Edit note |
| --- | --- | --- | --- |
| 0:00–0:12 | Ruvel hero. Hold on “Say it once.” and “I lost my job yesterday. Help me.” | “Life crosses organisations. Websites don't. When something major happens, people are forced to become the integration layer between every service they depend on.” | Clean opening; no cursor over text. |
| 0:12–0:28 | Start Mission, show the warm Mission Passport, then approve. | “Ruvel Mission lets you delegate the outcome once. But the agent doesn't get unlimited authority. Humans delegate outcomes. Sites retain authority. Agents coordinate capabilities.” | Subtle crop toward Passport. |
| 0:28–0:48 | Open CivicAid. Show two Site Tools; execute `check_eligibility({})`, then `prepare_support_claim({})`. Hold briefly on identity arguments 0. | “CivicAid already knows who is signed in, so identity doesn't need to be copied into the agent's tool arguments. The session is the reference.” | Trim request waiting time, never fake the result. |
| 0:48–1:10 | Open BrightEnergy. Show **2 Site Tools**, account summary and hardship support; `change_plan` is absent. | “BrightEnergy exposes only the capabilities this Mission currently allows.” | Establish the before state clearly. |
| 1:10–1:42 | Say/request: “Actually, move me to BrightEnergy's cheapest plan too.” Show that `change_plan` is unavailable. Grant **Change plan — this Mission only**; show actual **2 → 3** and `change_plan` appearing; call it. | “The agent can't simply talk its way around the policy. Permission isn't a prompt. It's whether the capability exists.” | Centerpiece. Use one short callout around 2 → 3. Do not cut across the state change. |
| 1:42–1:58 | Show “Switch to Saver Flex?”, $31/month estimated saving, Approve and Not now. Click Approve, then complete continuation. | “Even after authority is granted, the consequential decision remains with the human.” | Let the approval UI breathe; trim only network wait. |
| 1:58–2:15 | Open NextStep, register the profile, match three roles, show DEMO OPPORTUNITY cards. | “The same Mission continues into another independent WebMCP site without changing the architecture.” | Move quickly; show the fictional label. |
| 2:15–2:36 | Return to Ruvel. Show CivicAid, BrightEnergy and NextStep COMPLETE. Select Complete Mission. | No extra technical narration; let the outcome land. | A subtle crop may keep all three status cards visible. |
| 2:36–2:50 | Open Mission Receipt. Show 3 organisations, 3/3 complete, 7 actions, 3 authority decisions, 0 identity-bearing arguments and timeline. | “The Passport records authority before execution. The Mission Receipt records accountability after it. Humans delegate outcomes. Sites retain authority. Agents coordinate capabilities. Ruvel Mission. Say it once.” | Finish on the Receipt and product name. |

## The five ideas that must land

1. Life crosses organisations. Websites don't.
2. One outcome becomes one Mission.
3. Independent sites expose bounded WebMCP capabilities.
4. Human permission changes the actual capability surface.
5. Humans keep consequential decisions and receive an accountable Receipt.

Remove anything that does not strengthen one of these ideas.

## Recording checklist

- Use the clean screenshot/recording Mission, never an old validation handle.
- Reset Demo and approve a fresh Passport.
- Confirm Ruvel, CivicAid, BrightEnergy and NextStep respond over trusted HTTPS.
- Confirm CivicAid registers exactly two tools.
- Confirm BrightEnergy registers exactly two initial tools.
- Confirm NextStep registers exactly two tools.
- Use one clean browser window with no debug panels, console, unrelated tabs or credential dialogs.
- Use a consistent desktop viewport and readable zoom.
- Hide notifications and close unrelated applications.
- Confirm stable network connectivity.
- Rehearse the path once before recording.
- Start the real take from a second freshly reset Mission.

## Editing rules

Allowed:

- trim network waiting time
- subtle zoom or crop
- short title card and captions
- one restrained highlight around the 2 → 3 change
- highlights around the Passport and Receipt

Avoid:

- stock footage or cinematic filler
- fake UI or fake agent calls
- excessive transitions
- cutting so aggressively that an actual state change looks fabricated
- speeding interactions to an implausible rate
- adding architecture claims that are not proven by the deployed product

## Reliability and recovery

- If a partner is refreshed, use its normal Return to Ruvel control; the opaque Mission handle is preserved.
- If approval is missing, return to Ruvel and approve the Passport.
- If the flow is stale, use Reset Demo rather than repairing state manually.
- If Site Tools do not show the expected initial count, stop the take and begin from a fresh reset.
- BrightEnergy pending approval is designed to return quickly; the human decision and continuation are separate.
- Do not change the product to make recording easier unless a genuine deployed bug is discovered.
