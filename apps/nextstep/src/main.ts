import { MissionClient } from "../../../packages/mission-core/src/browser-client";
import { friendlyMissionError, withActionFeedback } from "../../../packages/mission-core/src/presentation";
import { nextStepToolDefinition } from "../../../packages/mission-core/src/nextstep-tools";
import { NEXTSTEP_CAPABILITIES, type MissionState, type NextStepCapability } from "../../../packages/mission-core/src/types";
import { registerOwnedTool, requireElement, type OwnedRegistration } from "../../../packages/spike-core/src/index";
import "./styles.css";

let state: MissionState | undefined;
const registrations = new Map<NextStepCapability, OwnedRegistration>();
const client = new MissionClient(async response => { state = response.state; await sync(); render(); });
function notice(message: string) { requireElement<HTMLElement>("#notice").textContent = friendlyMissionError(message); }
async function sync() {
  const desired = state?.passport.approved ? state.passport.scopes.nextstep ?? [] : [];
  for (const [name, registration] of registrations) if (!desired.includes(name)) { registration.unregister(); registrations.delete(name); }
  if (document.modelContext) for (const name of NEXTSTEP_CAPABILITIES) {
    if (!desired.includes(name) || registrations.has(name)) continue;
    const registration = registerOwnedTool(document.modelContext, nextStepToolDefinition(name, input => withActionFeedback(name, () => client.action(name, input), notice)));
    try { await registration.ready; registrations.set(name, registration); } catch (error) { registration.unregister(); notice(String(error)); }
  }
  requireElement<HTMLElement>("#capability-count").textContent = String(registrations.size);
  requireElement<HTMLElement>("#webmcp-state").textContent = document.modelContext ? `${registrations.size} registered with this site` : "WebMCP unavailable in this browser";
  if (state && !state.passport.scopes.nextstep) notice("This older Passport has no NextStep scope. Reset and reapprove at Ruvel Mission.");
}
function render() {
  const next = state?.nextstep;
  const active = next?.profileStatus === "active";
  const profile = requireElement<HTMLElement>("#profile-status");
  profile.textContent = active ? "Active" : "Not registered"; profile.dataset.state = active ? "active" : "waiting";
  const matches = next?.roleMatches ?? [];
  requireElement<HTMLElement>("#match-count").textContent = matches.length ? `${matches.length} opportunities found` : "None yet";
  requireElement<HTMLElement>("#completion-card").hidden = next?.status !== "completed";
  const list = requireElement<HTMLElement>("#role-matches"); list.replaceChildren();
  if (!matches.length) {
    const empty = document.createElement("p"); empty.className = "empty";
    empty.textContent = active ? "Your profile is ready. Ask your agent to find three suitable roles." : "Register your profile, then ask your agent to find three suitable roles.";
    list.append(empty);
  }
  for (const match of matches) {
    const card = document.createElement("article"); card.className = "role-card";
    const label = document.createElement("small"); label.textContent = "DEMO OPPORTUNITY";
    const title = document.createElement("h3"); title.textContent = match.title;
    const location = document.createElement("p"); location.textContent = `${match.location} · ${match.workMode}`;
    card.append(label, title, location); list.append(card);
  }
}
requireElement<HTMLButtonElement>("#return-mission").addEventListener("click", () => client.navigate("mission"));
requireElement<HTMLButtonElement>("#reset-demo").addEventListener("click", () => { void client.reset().then(() => notice("All three organisations reset. Reapprove the Passport at Ruvel Mission.")).catch(error => notice(String(error))); });
void client.initialize(true).catch(error => notice(error instanceof Error ? error.message : "Unable to open mission"));
client.observe(message => { notice(message); if (/PASSPORT|MISSION_NOT_FOUND/u.test(message)) { state = undefined; for (const registration of registrations.values()) registration.unregister(); registrations.clear(); void sync(); render(); } });
window.addEventListener("beforeunload", () => { for (const registration of registrations.values()) registration.unregister(); });
