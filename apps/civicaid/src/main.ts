import { MissionClient } from "../../../packages/mission-core/src/browser-client";
import { friendlyMissionError, withActionFeedback } from "../../../packages/mission-core/src/presentation";
import { CIVIC_CAPABILITIES, type CivicCapability, type MissionState } from "../../../packages/mission-core/src/types";
import { registerOwnedTool, requireElement, type OwnedRegistration } from "../../../packages/spike-core/src/index";
import "./styles.css";

let state: MissionState | undefined;
const registrations = new Map<CivicCapability, OwnedRegistration>();
const client = new MissionClient(async (response) => { state = response.state; await sync(); render(); });
function notice(message: string) { requireElement<HTMLElement>("#notice").textContent = friendlyMissionError(message); }
async function sync() {
  const desired = state?.passport.approved ? state.passport.scopes.civicaid : [];
  for (const [name, registration] of registrations) if (!desired.includes(name)) { registration.unregister(); registrations.delete(name); }
  if (document.modelContext) for (const name of CIVIC_CAPABILITIES) {
    if (!desired.includes(name) || registrations.has(name)) continue;
    const registration = registerOwnedTool(document.modelContext, {
      name, title: name === "check_eligibility" ? "Check CivicAid support eligibility" : "Prepare a CivicAid support claim",
      description: name === "check_eligibility"
        ? "Check fictional financial-support eligibility using CivicAid's signed-in demo session. No name, address, account or identity arguments are needed."
        : "Prepare, but do not submit, a fictional support claim from CivicAid's signed-in session, site records and mission-authorised disclosures. Check eligibility first. No identity arguments are needed.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: name === "check_eligibility" },
      execute: async (input) => withActionFeedback(name, () => client.action(name, input), notice),
    });
    try { await registration.ready; registrations.set(name, registration); } catch (error) { registration.unregister(); notice(String(error)); }
  }
  requireElement<HTMLElement>("#capability-count").textContent = String(registrations.size);
  requireElement<HTMLElement>("#webmcp-state").textContent = document.modelContext ? `${registrations.size} registered with this site` : "WebMCP unavailable in this browser";
}
function render() {
  if (!state) return;
  const civic = state.civicaid;
  requireElement<HTMLElement>("#eligibility").textContent = civic.eligibility === "eligible" ? "Likely eligible" : "Unchecked";
  requireElement<HTMLElement>("#support").textContent = civic.estimatedFortnightlySupport === null ? "—" : `$${civic.estimatedFortnightlySupport} / fortnight`;
  requireElement<HTMLElement>("#claim-status").textContent = civic.claim === "prepared" ? "Prepared" : "None";
  requireElement<HTMLElement>("#claim-card").hidden = civic.claim !== "prepared";
  requireElement<HTMLElement>("#field-counts").textContent = `${civic.fields.filter(f => f.value !== null).length} fields prepared · ${civic.fields.filter(f => f.value === null).length} needs human input`;
  const fields = requireElement<HTMLElement>("#claim-fields"); fields.replaceChildren();
  for (const field of civic.fields) {
    const row = document.createElement("div"), label = document.createElement("dt"), value = document.createElement("dd");
    label.textContent = field.label; value.textContent = field.value ?? "Your confirmation needed"; row.append(label, value); fields.append(row);
  }
  const calls = state.audit.filter(event => event.origin === client.sites?.civicaid && event.kind === "tool_invoked");
  const log = requireElement<HTMLOListElement>("#argument-log"); log.replaceChildren();
  for (const call of calls) { const li = document.createElement("li"); li.textContent = `${call.capability}(${JSON.stringify(call.redactedArgs ?? {})})`; log.append(li); }
  requireElement<HTMLElement>("#identifier-count").textContent = String(calls.reduce((count, call) => count + (call.identifierArgumentCount ?? 0), 0));
}
requireElement<HTMLButtonElement>("#return-mission").addEventListener("click", () => client.navigate("mission"));
requireElement<HTMLButtonElement>("#reset-demo").addEventListener("click", () => { void client.reset().then(() => notice("All three organisations reset. Reapprove the Passport at Ruvel Mission.")).catch((error: unknown) => notice(String(error))); });
void client.initialize(true).catch((error: unknown) => notice(error instanceof Error ? error.message : "Unable to open mission"));
client.observe((message) => { notice(message); if (/PASSPORT|MISSION_NOT_FOUND/u.test(message)) { state = undefined; for (const registration of registrations.values()) registration.unregister(); registrations.clear(); void sync(); } });
window.addEventListener("beforeunload", () => { for (const registration of registrations.values()) registration.unregister(); });
