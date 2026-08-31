import type { MissionReceipt, ReceiptMoment } from "../../../packages/mission-core/src/receipt";

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = "") {
  const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node;
}
function timestamp(at: number) { return new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" }); }
function moments(items: ReceiptMoment[], className: string) {
  const list = element("ol", "", className);
  for (const item of items) {
    const row = element("li"), body = element("div"), time = element("time", item.at === null ? "—" : new Date(item.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    if (item.at !== null) time.dateTime = new Date(item.at).toISOString();
    body.append(element("strong", item.label)); if (item.note) body.append(element("p", item.note)); row.append(time, body); list.append(row);
  }
  return list;
}
export function renderReceipt(container: HTMLElement, receipt: MissionReceipt) {
  container.replaceChildren();
  const heading = element("header", "", "receipt-header");
  heading.append(element("p", "RUVEL MISSION · SAY IT ONCE.", "eyebrow"), element("span", "MISSION COMPLETE", "receipt-seal"), element("h2", receipt.title));
  const meta = element("div", "", "receipt-meta");
  const identity = element("p", `Mission ${receipt.maskedMissionId}`); identity.id = "receipt-masked-id";
  const completed = element("time", `Completed ${timestamp(receipt.completedAt)}`); completed.dateTime = new Date(receipt.completedAt).toISOString();
  meta.append(identity, completed); heading.append(meta); container.append(heading);
  const metrics = element("dl", "", "receipt-metrics");
  const seconds = Math.floor(receipt.summary.elapsedMs / 1000);
  const rows = [
    ["organisations", "Organisations coordinated", String(receipt.summary.organisations)],
    ["completed", "Completed", `${receipt.summary.completed} / ${receipt.summary.organisations}`],
    ["actions", "Recorded tool actions", String(receipt.summary.recordedToolActions)],
    ["decisions", "Authority decisions", String(receipt.summary.authorityDecisions)],
    ["elapsed", "Elapsed", `${Math.floor(seconds / 60)}m ${seconds % 60}s`],
  ];
  for (const [key, label, value] of rows) { const row = element("div"), number = element("dd", value); number.id = `receipt-${key}`; row.append(element("dt", label), number); metrics.append(row); }
  container.append(metrics, element("p", "Tool actions count canonical invocation records, not audit rows or every transport call. Continuations and idempotent repeats may not create another action record. Authority decisions count Passport approval, scope grants and action approvals.", "receipt-note"));
  const results = element("section", "", "receipt-results"); results.setAttribute("aria-label", "Organisation results");
  for (const organisation of receipt.organisations) {
    const card = element("article", "", "receipt-organisation"); card.dataset.organisation = organisation.key;
    card.append(element("span", organisation.complete ? "COMPLETE" : "INCOMPLETE", "receipt-status"), element("h3", organisation.name));
    const list = element("ul"); for (const outcome of organisation.outcomes) list.append(element("li", `✓ ${outcome}`)); card.append(list);
    if (organisation.estimate !== null) { const value = element("strong", new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(organisation.estimate)); value.dataset.estimate = organisation.key; card.append(value, element("small", `${organisation.estimateLabel} · AUD`)); }
    if (organisation.key !== "brightenergy") card.append(element("p", `Identity-bearing arguments: ${organisation.identityArguments ?? "not recorded"}`, "receipt-note"));
    results.append(card);
  }
  container.append(results);
  const privacy = element("section", "", "receipt-privacy");
  privacy.append(element("p", "DATA MINIMISATION", "eyebrow"), element("h3", "The session is the reference."));
  const count = element("strong", String(receipt.privacy.identityBearingArguments ?? "Not recorded"), "privacy-number"); count.id = "receipt-identifiers";
  privacy.append(count, element("p", "Identity-bearing arguments in recorded tool invocations"), element("p", "CivicAid and NextStep resolved the fictional citizen from their own signed-in sessions."), element("p", "Identity did not need to be supplied in these WebMCP tool arguments because participating sites resolved the signed-in user from their own sessions. This does not mean the AI saw no personal data, or that data never left a site.", "receipt-note"));
  container.append(privacy);
  const authority = element("section", "", "receipt-authority");
  authority.append(element("p", "MISSION AUTHORITY", "eyebrow"), element("h3", "BrightEnergy · change_plan"), moments(receipt.authority, "authority-history"));
  container.append(authority);
  const timeline = element("section", "", "receipt-timeline"); timeline.append(element("p", "THE MISSION, ACCOUNTED FOR", "eyebrow"), element("h3", "What happened"), moments(receipt.timeline, "human-timeline")); container.append(timeline);
  const details = element("details", "", "technical-audit"); details.append(element("summary", `View technical audit · ${receipt.summary.auditEvents} events`));
  const audit = element("ol");
  for (const event of receipt.technicalAudit) {
    const row = element("li"); row.append(element("time", timestamp(event.at)), element("strong", `${event.event} · ${event.capability}`), element("span", event.origin), element("code", `Arguments ${JSON.stringify(event.arguments)}`), element("code", `Result ${JSON.stringify(event.result)}`)); audit.append(row);
  }
  details.append(audit, element("p", "Approval is represented by approval-requested, human-approved and completed events. Bearer handles, approval identifiers, session values and raw citizen details are omitted.", "receipt-note")); container.append(details);
  container.append(element("footer", "Mission Passport = authority before execution. Mission Receipt = accountability after execution. All outcomes and amounts are fictional demo data.", "receipt-footer"));
}
