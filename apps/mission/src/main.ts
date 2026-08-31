import type { MissionState } from "../../../packages/mission-core/src/index";
import { MissionClient } from "../../../packages/mission-core/src/browser-client";
import { requireElement } from "../../../packages/spike-core/src/index";
import { humanTimeline, type MissionReceipt } from "../../../packages/mission-core/src/receipt";
import { friendlyMissionError, withActionFeedback } from "../../../packages/mission-core/src/presentation";
import { renderReceipt } from "./receipt-view";
import "./styles.css";

let state: MissionState | undefined;
let receipt: MissionReceipt | null = null;
let receiptOpen = false;
let receiptRevision = "";
const client = new MissionClient((response) => { state = response.state; receipt = response.receipt ?? null; render(); });

function render() {
  const approved = state?.passport.approved === true;
  const complete = state?.brightenergy.plan === "saver_flex" && state?.brightenergy.hardshipStatus === "temporary_relief";
  const civicComplete = state?.civicaid.claim === "prepared";
  const nextComplete = state?.nextstep?.status === "completed";
  const nextAuthorized = approved && (state?.passport.scopes.nextstep?.length ?? 0) === 2;
  requireElement<HTMLElement>("#nextstep-status").textContent = nextComplete ? "Complete" : nextAuthorized ? "Ready" : approved ? "Reset required" : "Waiting";
  requireElement<HTMLElement>("#nextstep-status").dataset.state = nextComplete ? "complete" : nextAuthorized ? "ok" : "waiting";
  requireElement<HTMLButtonElement>("#continue-nextstep").disabled = !nextAuthorized;
  requireElement<HTMLElement>("#nextstep-scope-list").textContent = state?.passport.scopes.nextstep?.join(", ") ?? "—";
  const nextOutcomes = requireElement<HTMLUListElement>("#nextstep-outcomes"); nextOutcomes.replaceChildren();
  if (state?.nextstep?.profileStatus === "active") addOutcome(nextOutcomes, "employment profile active");
  if (nextComplete) addOutcome(nextOutcomes, `${state?.nextstep.roleMatches.length} demo opportunities found`);
  requireElement<HTMLElement>("#mission-completion").hidden = !(civicComplete && complete && nextComplete) || Boolean(state?.completion);
  requireElement<HTMLElement>("#mission-finished").hidden = !receipt;
  requireElement<HTMLElement>("#finished-summary").textContent = receipt ? `${receipt.summary.organisations} organisations coordinated. One accountable Mission Receipt.` : "";
  requireElement<HTMLElement>("#passport-plan-scope").textContent = state?.passport.scopes.brightenergy.includes("change_plan") ? "✓ Change plan — granted for this mission only" : "○ Change plan — ask me when needed";
  for (const [id, done] of [["start", approved], ["civic", civicComplete], ["bright", complete], ["next", nextComplete], ["complete", Boolean(receipt)]] as const) requireElement<HTMLElement>(`#progress-${id}`).dataset.complete = String(done);
  if (!receipt) { receiptOpen = false; receiptRevision = ""; requireElement<HTMLElement>("#mission-receipt").replaceChildren(); }
  else {
    const version = `${receipt.maskedMissionId}:${receipt.completedAt}`;
    if (version !== receiptRevision) { renderReceipt(requireElement<HTMLElement>("#mission-receipt"), receipt); receiptRevision = version; }
  }
  showReceipt(receiptOpen);
  requireElement<HTMLElement>("#civic-status").textContent = civicComplete ? "Complete" : approved ? "Ready" : "Waiting";
  requireElement<HTMLElement>("#civic-status").dataset.state = civicComplete ? "complete" : approved ? "ok" : "waiting";
  requireElement<HTMLButtonElement>("#continue-civic").disabled = !approved;
  const civicOutcomes = requireElement<HTMLUListElement>("#civic-outcomes"); civicOutcomes.replaceChildren();
  if (state?.civicaid.eligibility === "eligible") addOutcome(civicOutcomes, "eligibility checked");
  if (civicComplete) addOutcome(civicOutcomes, "support claim prepared");
  requireElement<HTMLElement>("#passport-status").textContent = approved ? "Approved" : state ? "Awaiting approval" : "Not issued";
  requireElement<HTMLElement>("#passport-status").dataset.state = approved ? "ok" : "waiting";
  requireElement<HTMLElement>("#partner-status").textContent = complete ? "Complete" : approved ? "Ready" : "Waiting";
  requireElement<HTMLElement>("#partner-status").dataset.state = complete ? "complete" : approved ? "ok" : "waiting";
  requireElement<HTMLElement>("#scope-list").textContent = state?.passport.scopes.brightenergy.join(", ") ?? "—";
  requireElement<HTMLElement>("#civic-scope-list").textContent = state?.passport.scopes.civicaid.join(", ") ?? "—";
  requireElement<HTMLElement>("#passport-version").textContent = state ? String(state.passport.version) : "—";
  requireElement<HTMLButtonElement>("#approve-passport").disabled = !state || approved;
  requireElement<HTMLButtonElement>("#continue-partner").disabled = !approved;
  const outcomes = requireElement<HTMLUListElement>("#outcomes");
  outcomes.replaceChildren();
  if (state?.brightenergy.hardshipStatus === "temporary_relief") addOutcome(outcomes, "hardship protection activated");
  if (complete) {
    addOutcome(outcomes, "switched to Saver Flex");
    addOutcome(outcomes, "estimated saving $31/month");
  }
  requireElement<HTMLElement>("#partner-summary").textContent = complete
    ? "BrightEnergy completed its mission actions."
    : "Protect the account, then find a more affordable energy plan.";
  const audit = requireElement<HTMLOListElement>("#audit-list");
  audit.replaceChildren();
  if (!state) {
    const empty = document.createElement("li"); empty.className = "empty"; empty.textContent = "Start a mission to begin the trace."; audit.append(empty);
  } else {
    for (const item of [...humanTimeline(state)].reverse()) {
      const li = document.createElement("li");
      const label = document.createElement("span"); label.textContent = item.label;
      const time = document.createElement("time"); if (item.at !== null) { time.dateTime = new Date(item.at).toISOString(); time.textContent = new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
      li.append(label, time); audit.append(li);
    }
  }
  requireElement<HTMLElement>("#event-count").textContent = `${state?.audit.length ?? 0} events`;
  requireElement<HTMLElement>("#latest-activity").textContent = state ? humanTimeline(state).at(-1)?.label ?? "Mission created. Review your Passport." : "Start a mission to begin.";
}

function showReceipt(open: boolean) {
  receiptOpen = open && receipt !== null;
  requireElement<HTMLElement>("#receipt-view").hidden = !receiptOpen;
  requireElement<HTMLElement>("#mission-view").hidden = receiptOpen;
  requireElement<HTMLElement>("#view-receipt").setAttribute("aria-expanded", String(receiptOpen));
}

function addOutcome(list: HTMLUListElement, text: string) {
  const item = document.createElement("li"); item.textContent = `✓ ${text}`; list.append(item);
}

function notice(message: string) { requireElement<HTMLElement>("#notice").textContent = friendlyMissionError(message); }

function run(task: Promise<unknown>, message: string) { void task.then(() => notice(message)).catch((error: unknown) => notice(error instanceof Error ? error.message : "Action failed")); }
requireElement<HTMLButtonElement>("#start-mission").addEventListener("click", () => run(client.reset(true), "Mission created. Review the Passport."));
requireElement<HTMLButtonElement>("#reset-demo").addEventListener("click", () => run(client.reset(), "All three organisations reset to their clean state."));
requireElement<HTMLButtonElement>("#approve-passport").addEventListener("click", () => run(withActionFeedback("approve_passport", () => client.action("approve_passport"), notice), "Mission Passport approved."));
requireElement<HTMLButtonElement>("#complete-mission").addEventListener("click", () => run(withActionFeedback("complete_mission", () => client.action("complete_mission"), notice), "Mission complete. Your Receipt is ready."));
requireElement<HTMLButtonElement>("#view-receipt").addEventListener("click", () => { showReceipt(true); requireElement<HTMLElement>("#mission-receipt").focus(); });
requireElement<HTMLButtonElement>("#close-receipt").addEventListener("click", () => { showReceipt(false); requireElement<HTMLElement>("#view-receipt").focus(); });
requireElement<HTMLButtonElement>("#continue-partner").addEventListener("click", () => client.navigate("brightenergy"));
requireElement<HTMLButtonElement>("#continue-civic").addEventListener("click", () => client.navigate("civicaid"));
requireElement<HTMLButtonElement>("#continue-nextstep").addEventListener("click", () => client.navigate("nextstep"));

render();
void client.initialize().catch((error: unknown) => notice(error instanceof Error ? error.message : "Unable to restore mission"));
client.observe(notice);
