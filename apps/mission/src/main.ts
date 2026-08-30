import type { ActionResponse, MissionState } from "../../../packages/mission-core/src/index";
import { requireElement } from "../../../packages/spike-core/src/index";
import "./styles.css";

const STORAGE_KEY = "ruvel.phase1.mission";
let token = "";
let state: MissionState | undefined;

function brightOrigin() {
  const value = new URLSearchParams(location.search).get("brightOrigin");
  if (!value) throw new Error("Missing deployed BrightEnergy origin");
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("BrightEnergy must use HTTPS");
  return url.origin;
}

async function api(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json() as ActionResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  token = payload.token;
  state = payload.state;
  sessionStorage.setItem(STORAGE_KEY, token);
  render();
  return payload;
}

async function readReturnedToken() {
  const match = /^#mission=(.+)$/u.exec(location.hash);
  const returned = match?.[1] ? decodeURIComponent(match[1]) : sessionStorage.getItem(STORAGE_KEY);
  if (!returned) return;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  token = returned;
  await api("/api/action", { token, action: "read_state" });
}

function render() {
  const approved = state?.passport.approved === true;
  const complete = state?.brightenergy.plan === "saver_flex";
  requireElement<HTMLElement>("#passport-status").textContent = approved ? "Approved" : state ? "Awaiting approval" : "Not issued";
  requireElement<HTMLElement>("#passport-status").dataset.state = approved ? "ok" : "waiting";
  requireElement<HTMLElement>("#partner-status").textContent = complete ? "Complete" : approved ? "Ready" : "Waiting";
  requireElement<HTMLElement>("#partner-status").dataset.state = complete ? "complete" : approved ? "ok" : "waiting";
  requireElement<HTMLElement>("#scope-list").textContent = state?.passport.scopes.brightenergy.join(", ") ?? "—";
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
      li.append(label, time); audit.append(li);
    }
  }
  requireElement<HTMLElement>("#event-count").textContent = `${state?.audit.length ?? 0} events`;
}

function addOutcome(list: HTMLUListElement, text: string) {
  const item = document.createElement("li"); item.textContent = `✓ ${text}`; list.append(item);
}

function notice(message: string) { requireElement<HTMLElement>("#notice").textContent = message; }

requireElement<HTMLButtonElement>("#start-mission").addEventListener("click", () => void api("/api/reset", {}).then(() => notice("Mission created. Review the Passport.")));
requireElement<HTMLButtonElement>("#reset-demo").addEventListener("click", () => void api("/api/reset", {}).then(() => notice("Demo reset to its clean state.")));
requireElement<HTMLButtonElement>("#approve-passport").addEventListener("click", () => void api("/api/action", { token, action: "approve_passport" }).then(() => notice("Mission Passport approved.")));
requireElement<HTMLButtonElement>("#continue-partner").addEventListener("click", () => {
  location.href = `${brightOrigin()}/?returnOrigin=${encodeURIComponent(location.origin)}#mission=${encodeURIComponent(token)}`;
});

render();
void readReturnedToken().catch((error: unknown) => notice(error instanceof Error ? error.message : "Unable to restore mission"));
