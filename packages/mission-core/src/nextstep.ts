import { assertApproved, MissionError } from "./state";
import type { MissionState, NextStepCapability, RoleMatch } from "./types";

// NextStep owns this fictional record. Identity is never accepted as a tool argument.
export const nextStepDemoRecord = {
  displayName: "J. Citizen", employmentStatus: "Recently unemployed",
  preferredArea: "Sydney", rolePreference: "Software / technology", availability: "immediate",
} as const;
const demoRoles: RoleMatch[] = [
  { title: "AI Platform Engineer", location: "Sydney", workMode: "Hybrid", demo: true },
  { title: "Senior Software Engineer", location: "Sydney", workMode: "Hybrid", demo: true },
  { title: "Cloud Engineering Lead", location: "Remote Australia", workMode: "Remote", demo: true },
];

export function nextStepAction(state: MissionState, capability: NextStepCapability, input: Record<string, unknown>, now: number) {
  assertApproved(state);
  // Missing scopes never gain authority; stale signatures are rejected before this reducer.
  if (!state.passport.scopes.nextstep?.includes(capability)) {
    throw new MissionError("MISSION_SCOPE_DENIED", 403, { capability: `nextstep.${capability}` });
  }
  if (!state.nextstep) throw new MissionError("MISSION_RESET_REQUIRED", 409);
  if (!state.passport.disclosures.allowed.includes("employment disruption")) throw new MissionError("DISCLOSURE_DENIED", 403);
  const keys = Object.keys(input);
  if (capability === "register_profile" ? keys.length > 0 : keys.some(key => key !== "limit")) throw new MissionError("UNEXPECTED_TOOL_ARGUMENTS", 400);
  const limit = input.limit ?? 3;
  if (capability === "match_roles" && (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 3)) throw new MissionError("INVALID_ROLE_LIMIT", 400);

  let result: Record<string, unknown>;
  let nextStep = state.nextstep;
  if (capability === "register_profile") {
    result = { status: "registered", profileStatus: "active", demo: true };
    if (nextStep.profileStatus === "active") return { state, result };
    nextStep = { ...nextStep, status: "active", profileStatus: "active", availability: nextStepDemoRecord.availability };
  } else {
    if (nextStep.profileStatus !== "active") throw new MissionError("PROFILE_REQUIRED", 409);
    const matches = structuredClone(demoRoles.slice(0, limit as number));
    result = { matches, demo: true };
    // A read-only search changes no employment record or application. Only its
    // mission result and audit are persisted, as with the existing read tools.
    if (nextStep.status === "completed" && JSON.stringify(nextStep.roleMatches) === JSON.stringify(matches)) return { state, result };
    nextStep = { ...nextStep, status: "completed", roleMatches: matches };
  }
  const next = { ...state, nextstep: nextStep, passport: { ...state.passport, version: state.passport.version + 1 }, audit: [...state.audit] };
  for (const kind of ["tool_invoked", "tool_completed"] as const) {
    next.audit.push({ id: `event_${state.passport.missionId}_${next.audit.length + 1}`, at: now, kind, detail: capability });
  }
  return { state: next, result };
}
