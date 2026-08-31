import { assertApproved, MissionError } from "./state";
import type { CivicCapability, MissionState } from "./types";

// These fictional records belong to CivicAid, not the Mission or agent inputs.
export const civicDemoRecord = {
  displayName: "J. Citizen", reference: "•••• 2319", residence: "Sydney NSW",
  employmentStatus: "Recently unemployed", employmentEnd: "Yesterday (demo)",
};

export function civicAction(state: MissionState, capability: CivicCapability, input: Record<string, unknown>, now: number) {
  assertApproved(state);
  if (!state.passport.scopes.civicaid.includes(capability)) {
    throw new MissionError("MISSION_SCOPE_DENIED", 403, { capability: `civicaid.${capability}` });
  }
  if (Object.keys(input).length) throw new MissionError("UNEXPECTED_TOOL_ARGUMENTS", 400);
  if (!state.passport.disclosures.allowed.includes("employment disruption")) throw new MissionError("DISCLOSURE_DENIED", 403);
  let next = structuredClone(state);
  const add = (kind: "tool_invoked" | "tool_completed") => {
    next.audit.push({ id: `event_${state.passport.missionId}_${next.audit.length + 1}`, at: now, kind, detail: capability });
  };
  add("tool_invoked");
  let result: Record<string, unknown>;
  if (capability === "check_eligibility") {
    next.civicaid.eligibility = "eligible";
    next.civicaid.estimatedFortnightlySupport = 782;
    result = { eligible: true, estimatedFortnightlySupport: 782, reason: "recent_job_loss", nextStep: "prepare_support_claim", demo: true };
  } else {
    if (state.civicaid.eligibility !== "eligible") throw new MissionError("ELIGIBILITY_CHECK_REQUIRED", 409);
    const fields = [
      { key: "citizen", label: "Citizen", value: civicDemoRecord.displayName, source: "CivicAid signed-in session" },
      { key: "residence", label: "Residence", value: civicDemoRecord.residence, source: "CivicAid records" },
      { key: "employment", label: "Employment status", value: civicDemoRecord.employmentStatus, source: "Authorised employment disclosure" },
      { key: "start", label: "Support start", value: civicDemoRecord.employmentEnd, source: "CivicAid records" },
      { key: "program", label: "Support program", value: "Temporary job-loss support (demo)", source: "Eligibility result" },
      { key: "declaration", label: "Confirm circumstances are correct", value: null, source: "Human input needed — not submitted" },
    ];
    next.civicaid = { ...next.civicaid, claim: "prepared", claimId: `demo_claim_${state.passport.missionId.slice(-8)}`, fields };
    result = { status: "prepared", claimId: next.civicaid.claimId, fieldsPrepared: fields.filter(f => f.value !== null).length, fieldsNeedingHumanInput: fields.filter(f => f.value === null).length, demo: true };
  }
  next = { ...next, passport: { ...next.passport, version: next.passport.version + 1 } };
  add("tool_completed");
  return { state: next, result };
}

const identityKeys = /^(name|fullname|dob|birthdate|taxidentifier|taxid|tfn|accountnumber|address|customerid|citizenid|email|phone|identifier)$/iu;
export function redactArguments(input: Record<string, unknown>) {
  let identifierArgumentCount = 0;
  const redactedArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (identityKeys.test(key.replaceAll("_", ""))) {
      identifierArgumentCount += 1;
      redactedArgs[key] = "[REDACTED]";
    } else if (key === "limit" && typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 3) {
      redactedArgs[key] = value;
    } else if (key === "program" || key === "plan") {
      redactedArgs[key] = value === "temporary_relief" || value === "saver_flex" ? value : "[REDACTED]";
    } else redactedArgs[key] = "[REDACTED]";
  }
  return { redactedArgs, identifierArgumentCount };
}
