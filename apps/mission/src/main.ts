import type { MissionState } from "../../../packages/mission-core/src/index";
import { MissionClient } from "../../../packages/mission-core/src/browser-client";
import { requireElement } from "../../../packages/spike-core/src/index";
import "./styles.css";

let state: MissionState | undefined;
const client = new MissionClient((response) => { state = response.state; render(); });

function render() {
  const approved = state?.passport.approved === true;
  const complete = state?.brightenergy.plan === "saver_flex" && state?.brightenergy.hardshipStatus === "temporary_relief";
  const civicComplete = state?.civicaid.claim === "prepared";
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
    for (const item of [...state.audit].reverse()) {
      const li = document.createElement("li");
      const label = document.createElement("span"); label.textContent = item.detail ? `${item.kind}:${item.detail}` : item.kind;
      const time = document.createElement("time"); time.dateTime = new Date(item.at).toISOString(); time.textContent = new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const origin = document.createElement("small"); origin.textContent = item.origin ? new URL(item.origin).hostname.split(".")[0] ?? "" : "";
      li.append(label, origin, time); audit.append(li);
    }
  }
  requireElement<HTMLElement>("#event-count").textContent = `${state?.audit.length ?? 0} events`;
}

function addOutcome(list: HTMLUListElement, text: string) {
  const item = document.createElement("li"); item.textContent = `✓ ${text}`; list.append(item);
}

function notice(message: string) { requireElement<HTMLElement>("#notice").textContent = message; }

function run(task: Promise<unknown>, message: string) { void task.then(() => notice(message)).catch((error: unknown) => notice(error instanceof Error ? error.message : "Action failed")); }
requireElement<HTMLButtonElement>("#start-mission").addEventListener("click", () => run(client.reset(true), "Mission created. Review the Passport."));
requireElement<HTMLButtonElement>("#reset-demo").addEventListener("click", () => run(client.reset(), "Both organisations reset to their clean state."));
requireElement<HTMLButtonElement>("#approve-passport").addEventListener("click", () => run(client.action("approve_passport"), "Mission Passport approved."));
requireElement<HTMLButtonElement>("#continue-partner").addEventListener("click", () => client.navigate("brightenergy"));
requireElement<HTMLButtonElement>("#continue-civic").addEventListener("click", () => client.navigate("civicaid"));

render();
void client.initialize().catch((error: unknown) => notice(error instanceof Error ? error.message : "Unable to restore mission"));
client.observe(notice);
