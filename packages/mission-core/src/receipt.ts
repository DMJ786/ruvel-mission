import { assertApproved, MissionError } from "./state";
import type { AuditEvent, DurableResponse, MissionState } from "./types";

const partners = { civicaid: "CivicAid", brightenergy: "BrightEnergy", nextstep: "NextStep" } as const;
type Partner = keyof typeof partners;
type Sites = DurableResponse["sites"];
export type ReceiptMoment = { at: number | null; label: string; note?: string };
export type MissionReceipt = {
  title: "Job loss recovery"; maskedMissionId: string; completedAt: number;
  summary: { organisations: number; completed: number; recordedToolActions: number; authorityDecisions: number; auditEvents: number; elapsedMs: number };
  privacy: { identityBearingArguments: number | null; invocationRecords: number; qualified: boolean };
  organisations: { key: Partner; name: string; complete: boolean; outcomes: string[]; identityArguments: number | null; estimate: number | null; estimateLabel: string | null }[];
  authority: ReceiptMoment[]; timeline: ReceiptMoment[];
  technicalAudit: { at: number; origin: string; capability: string; event: string; arguments: Record<string, unknown>; result: Record<string, unknown> }[];
};

export function partnerProgress(state: MissionState) {
  return {
    civicaid: state.civicaid.eligibility === "eligible" && state.civicaid.claim === "prepared",
    brightenergy: state.brightenergy.plan === "saver_flex" && state.brightenergy.hardshipStatus === "temporary_relief",
    nextstep: state.nextstep?.status === "completed" && state.nextstep.profileStatus === "active" && state.nextstep.roleMatches.length > 0,
  };
}
export function completeMission(state: MissionState, now: number) {
  assertApproved(state);
  const blockers = Object.entries(partnerProgress(state)).filter(([, complete]) => !complete).map(([key]) => partners[key as Partner]);
  if (blockers.length) throw new MissionError("MISSION_INCOMPLETE", 409, { blockers });
  if (state.completion) return { state, result: { status: "completed", idempotent: true } };
  const next: MissionState = { ...state, completion: { completedAt: now }, passport: { ...state.passport, version: state.passport.version + 1 },
    audit: [...state.audit, { id: `event_${state.passport.missionId}_${state.audit.length + 1}`, at: now, kind: "mission_completed" }] };
  return { state: next, result: { status: "completed" } };
}

function orderedAudit(state: MissionState) {
  return [...new Map(state.audit.map(event => [event.id, event])).values()].sort((a, b) => a.at - b.at);
}
function identityCount(events: AuditEvent[]): number | null {
  if (!events.length || events.some(event => !event.redactedArgs || !Number.isInteger(event.identifierArgumentCount) || event.identifierArgumentCount! < 0)) return null;
  return events.reduce((sum, event) => sum + event.identifierArgumentCount!, 0);
}
const toolLabels: Record<string, string> = {
  check_eligibility: "CivicAid checked support eligibility",
  prepare_support_claim: "CivicAid prepared a support claim — not submitted",
  get_account_summary: "BrightEnergy reviewed the energy account",
  apply_hardship: "BrightEnergy activated temporary hardship assistance",
  change_plan: "BrightEnergy completed the approved Saver Flex change",
  register_profile: "NextStep activated the employment profile",
  match_roles: "NextStep found demo opportunities",
};
function capability(event: AuditEvent) {
  const name = event.capability ?? event.detail ?? "";
  return name in toolLabels ? name : "";
}
export function humanTimeline(state: MissionState): ReceiptMoment[] {
  return orderedAudit(state).flatMap(event => {
    let label = "";
    if (event.kind === "passport_approved") label = "Mission Passport approved";
    else if (event.kind === "capability_granted" && capability(event) === "change_plan") label = "You granted BrightEnergy plan changes — this mission only";
    else if (event.kind === "human_approved") label = "You approved Saver Flex";
    else if (event.kind === "tool_completed") label = toolLabels[capability(event)] ?? "";
    else if (event.kind === "mission_completed") label = "Mission completed";
    return label ? [{ at: event.at, label }] : [];
  });
}
function safeArguments(input: Record<string, unknown> = {}) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "limit" && Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 3) result.limit = value;
    else if ((key === "plan" && value === "saver_flex") || (key === "program" && value === "temporary_relief")) result[key] = value;
    else result.otherArguments = "[REDACTED]";
  }
  return result;
}
function safeResult(input: Record<string, unknown> = {}) {
  const result: Record<string, unknown> = {};
  const words = new Set(["completed", "prepared", "applied", "registered", "active", "approved", "awaiting_approval", "granted", "Saver Flex", "Standard Flex", "temporary_relief", "none"]);
  for (const key of ["status", "profileStatus", "hardshipStatus", "plan"]) if (typeof input[key] === "string" && words.has(input[key] as string)) result[key] = input[key];
  for (const key of ["eligible", "demo", "idempotent"]) if (typeof input[key] === "boolean") result[key] = input[key];
  for (const key of ["estimatedMonthlyCost", "estimatedMonthlySaving", "estimatedFortnightlySupport", "fieldsPrepared", "fieldsNeedingHumanInput"]) if (typeof input[key] === "number" && Number.isFinite(input[key])) result[key] = input[key];
  if (Array.isArray(input.matches)) result.opportunities = input.matches.length;
  return result;
}

export function deriveReceipt(state: MissionState, sites: Sites): MissionReceipt | null {
  const progress = partnerProgress(state);
  if (!state.completion || !state.passport.approved || Object.values(progress).some(done => !done)) return null;
  const events = orderedAudit(state);
  if (!events.some(event => event.kind === "mission_completed" && event.at === state.completion!.completedAt)) return null;
  const calls = events.filter(event => event.kind === "tool_invoked");
  const participantKeys = (Object.keys(partners) as Partner[]).filter(key => Array.isArray(state.passport.scopes[key]));
  const organisations = participantKeys.map(key => {
    const local = calls.filter(event => event.origin === sites[key]);
    let estimate: number | null = null, estimateLabel: string | null = null;
    const outcomes: string[] = [];
    if (key === "civicaid") {
      if (state.civicaid.eligibility === "eligible") outcomes.push("Eligibility checked");
      if (state.civicaid.claim === "prepared") outcomes.push("Support claim prepared — not submitted");
      estimate = state.civicaid.estimatedFortnightlySupport; estimateLabel = "DEMO ESTIMATE / fortnight";
    } else if (key === "brightenergy") {
      if (state.brightenergy.hardshipStatus === "temporary_relief") outcomes.push("Temporary hardship activated");
      if (state.brightenergy.plan === "saver_flex") outcomes.push("Saver Flex approved and activated");
      const previous = events.find(event => event.origin === sites.brightenergy && capability(event) === "get_account_summary" && event.kind === "tool_completed")?.resultSummary?.estimatedMonthlyCost;
      if (typeof previous === "number") estimate = previous - state.brightenergy.estimatedMonthlyCost;
      estimateLabel = "DEMO estimated monthly saving";
    } else {
      if (state.nextstep.profileStatus === "active") outcomes.push("Employment profile active");
      outcomes.push(`${state.nextstep.roleMatches.length} demo opportunities identified`);
    }
    return { key, name: partners[key], complete: progress[key], outcomes, identityArguments: identityCount(local), estimate, estimateLabel };
  });
  const bright = events.filter(event => event.origin === sites.brightenergy && capability(event) === "change_plan");
  const authority: ReceiptMoment[] = [];
  const granted = bright.find(event => event.kind === "capability_granted");
  if (granted) authority.push({ at: null, label: "Initially not granted" }, { at: granted.at, label: "Granted by human", note: "This mission only" }, { at: null, label: "Capability made available by scope", note: "After grant. Exact native registration time is not recorded in the canonical audit." });
  for (const event of bright) {
    const labels: Partial<Record<AuditEvent["kind"], string>> = { tool_invoked: "Agent requested Saver Flex", human_approval_requested: "Human approval requested", human_approved: "Human approved", tool_completed: "Approved change completed" };
    if (labels[event.kind]) authority.push({ at: event.at, label: labels[event.kind]! });
  }
  const safeOrigins = new Set(Object.values(sites));
  const started = events.find(event => event.kind === "mission_started")?.at ?? state.passport.issuedAt;
  const identityBearingArguments = identityCount(calls);
  return {
    title: "Job loss recovery", maskedMissionId: `m_••••${state.passport.missionId.slice(-4).toUpperCase()}`, completedAt: state.completion.completedAt,
    summary: { organisations: organisations.length, completed: organisations.filter(item => item.complete).length, recordedToolActions: calls.length, authorityDecisions: events.filter(event => ["passport_approved", "capability_granted", "human_approved"].includes(event.kind)).length, auditEvents: events.length, elapsedMs: Math.max(0, state.completion.completedAt - started) },
    privacy: { identityBearingArguments, invocationRecords: calls.length, qualified: identityBearingArguments !== null }, organisations, authority, timeline: humanTimeline(state),
    technicalAudit: events.map(event => ({ at: event.at, origin: event.origin && safeOrigins.has(event.origin) ? new URL(event.origin).origin : "Not recorded", capability: capability(event) || "mission", event: event.kind, arguments: safeArguments(event.redactedArgs), result: safeResult(event.resultSummary) })),
  };
}
