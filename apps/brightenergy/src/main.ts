import { CHANGE_PLAN_CAPABILITY, type ActionName, type Capability, type MissionState } from "../../../packages/mission-core/src/index";
import { MissionClient } from "../../../packages/mission-core/src/browser-client";
import { registerOwnedTool, requireElement, type OwnedRegistration, type ToolDefinition } from "../../../packages/spike-core/src/index";
import "./styles.css";

let state: MissionState | undefined;
const registrations = new Map<Capability, OwnedRegistration>();
const client = new MissionClient(async (response) => { state = response.state; await syncRegistrations(); render(); });

async function api(action: ActionName, input: Record<string, unknown> = {}) {
  return client.action(action, input);
}

async function restore() {
  await client.initialize(true);
}

function desiredCapabilities(): Capability[] {
  if (!state?.passport.approved) return [];
  return state.passport.scopes.brightenergy;
}

function definition(capability: Capability): ToolDefinition {
  if (capability === "get_account_summary") return {
    name: capability,
    title: "Get BrightEnergy account summary",
    description: "Read the fictional signed-in customer's current energy plan, estimated monthly cost, and hardship status. No customer identifier is required.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => api("get_account_summary"),
  };
  if (capability === "apply_hardship") return {
    name: capability,
    title: "Apply temporary hardship relief",
    description: "Activate the temporary relief program for the fictional signed-in customer under the current Mission Passport.",
    inputSchema: { type: "object", properties: { program: { type: "string", enum: ["temporary_relief"] } }, required: ["program"], additionalProperties: false },
    annotations: { readOnlyHint: false },
    execute: async (input) => api("apply_hardship", input),
  };
  return {
    name: capability,
    title: "Request or complete a BrightEnergy plan change",
    description: "First request Saver Flex and receive awaiting_approval. After the human approves on the page, call this tool again with approvalId to complete idempotently.",
    inputSchema: {
      type: "object",
      properties: { plan: { type: "string", enum: ["saver_flex"] }, approvalId: { type: "string" } },
      additionalProperties: false,
      anyOf: [{ required: ["plan"] }, { required: ["approvalId"] }],
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => api("change_plan", input),
  };
}

async function syncRegistrations() {
  const context = document.modelContext;
  const desired = new Set(desiredCapabilities());
  for (const [name, registration] of registrations) {
    if (!desired.has(name)) { registration.unregister(); registrations.delete(name); }
  }
  if (!context) {
    requireElement<HTMLElement>("#webmcp-state").textContent = "WebMCP unavailable in this browser";
    updateCount();
    return;
  }
  for (const name of desired) {
    if (registrations.has(name)) continue;
    const registration = registerOwnedTool(context, definition(name));
    try {
      await registration.ready;
      registrations.set(name, registration);
    } catch (error) {
      registration.unregister();
      notice(error instanceof Error ? `Could not register ${name}: ${error.message}` : `Could not register ${name}`);
    }
  }
  requireElement<HTMLElement>("#webmcp-state").textContent = `${registrations.size} registered with this site`;
  updateCount();
}

function updateCount() {
  requireElement<HTMLElement>("#capability-count").textContent = String(registrations.size);
}

function pendingApproval() {
  return state ? Object.values(state.brightenergy.approvals).find((item) => item.completedAt === undefined) : undefined;
}

function render() {
  if (!state) return;
  const granted = state.passport.scopes.brightenergy.includes(CHANGE_PLAN_CAPABILITY);
  const complete = state.brightenergy.plan === "saver_flex";
  requireElement<HTMLElement>("#current-plan").textContent = complete ? "Saver Flex" : "Standard Flex";
  requireElement<HTMLElement>("#monthly-cost").textContent = `$${state.brightenergy.estimatedMonthlyCost}`;
  requireElement<HTMLElement>("#hardship-status").textContent = state.brightenergy.hardshipStatus === "temporary_relief" ? "Temporary relief" : "None";
  const change = requireElement<HTMLLIElement>("#change-capability");
  change.classList.toggle("granted", granted); change.querySelector("span")!.textContent = granted ? "✓" : "✕";
  requireElement<HTMLElement>("#authority-state").textContent = granted ? "Granted — this mission only" : "Not granted for this mission";
  requireElement<HTMLButtonElement>("#grant-capability").disabled = granted || !state.passport.approved;
  requireElement<HTMLButtonElement>("#request-change").disabled = !granted || complete || !state.passport.approved;
  const pending = pendingApproval();
  const card = requireElement<HTMLElement>("#approval-card"); card.hidden = pending === undefined;
  if (pending) {
    const approved = pending.approvedAt !== undefined;
    requireElement<HTMLButtonElement>("#approve-action").disabled = approved;
    requireElement<HTMLElement>("#approval-status").textContent = approved ? "Approved. The agent can now continue the action." : "Waiting for your decision.";
  }
  const brightEvents = state.audit.filter((item) => item.origin === client.sites?.brightenergy);
  requireElement<HTMLElement>("#event-count").textContent = `${brightEvents.length} events`;
  const list = requireElement<HTMLOListElement>("#audit-list"); list.replaceChildren();
  for (const item of [...brightEvents].reverse()) {
    const li = document.createElement("li"); li.textContent = item.detail ? `${item.kind}:${item.detail}` : item.kind; list.append(li);
  }
}

function notice(message: string) { requireElement<HTMLElement>("#notice").textContent = message; }
function act(action: ActionName, input: Record<string, unknown>, message: string) { void api(action, input).then(() => notice(message)).catch((error: unknown) => notice(error instanceof Error ? error.message : "Action failed")); }

requireElement<HTMLButtonElement>("#grant-capability").addEventListener("click", () => act("grant_change_plan", {}, "Change plan granted for this mission. Site Tools refreshed."));
requireElement<HTMLButtonElement>("#request-change").addEventListener("click", () => act("change_plan", { plan: "saver_flex" }, "Approval requested. The agent call has already returned."));
requireElement<HTMLButtonElement>("#approve-action").addEventListener("click", () => { const pending = pendingApproval(); if (pending) act("approve_action", { approvalId: pending.id }, "Approved. Ask the agent to continue with the approval ID."); });
requireElement<HTMLButtonElement>("#not-now").addEventListener("click", () => { requireElement<HTMLElement>("#approval-card").hidden = true; notice("Plan change left pending. No account change was made."); });
requireElement<HTMLButtonElement>("#return-mission").addEventListener("click", () => client.navigate("mission"));
requireElement<HTMLButtonElement>("#reset-demo").addEventListener("click", () => { void client.reset().then(() => notice("Both organisations reset. Approve the Passport again at Ruvel Mission.")).catch((error: unknown) => notice(error instanceof Error ? error.message : "Reset failed")); });

void restore().catch((error: unknown) => notice(error instanceof Error ? error.message : "Unable to open mission"));
window.addEventListener("beforeunload", () => { for (const registration of registrations.values()) registration.unregister(); });

client.observe((message) => {
  notice(message);
  if (/PASSPORT|MISSION_NOT_FOUND/u.test(message)) { for (const registration of registrations.values()) registration.unregister(); registrations.clear(); updateCount(); }
});
