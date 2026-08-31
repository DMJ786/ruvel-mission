import {
  BASE_CAPABILITIES,
  CHANGE_PLAN_CAPABILITY,
  CIVIC_CAPABILITIES,
  type Approval,
  type AuditEvent,
  type AuditKind,
  type Capability,
  type MissionState,
} from "./types";

export class MissionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly detail: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

function event(state: MissionState, now: number, kind: AuditKind, detail?: string): AuditEvent {
  return {
    id: `event_${state.passport.missionId}_${state.audit.length + 1}`,
    at: now,
    kind,
    ...(detail === undefined ? {} : { detail }),
  };
}

function append(state: MissionState, now: number, kind: AuditKind, detail?: string): MissionState {
  return { ...state, audit: [...state.audit, event(state, now, kind, detail)] };
}

function bump(state: MissionState): MissionState {
  return { ...state, passport: { ...state.passport, version: state.passport.version + 1 } };
}

export function createInitialState(now: number): MissionState {
  const missionId = `mission_${now}`;
  const state: MissionState = {
    passport: {
      missionId,
      version: 1,
      issuedAt: now,
      expiresAt: now + 60 * 60 * 1000,
      approved: false,
      scopes: { brightenergy: [...BASE_CAPABILITIES], civicaid: [...CIVIC_CAPABILITIES] },
      disclosures: {
        allowed: ["employment disruption", "account assistance status", "plan outcome", "support claim status"],
        forbidden: ["government identifier", "full account number", "payment credentials"],
      },
    },
    brightenergy: {
      plan: "standard_flex",
      estimatedMonthlyCost: 146,
      hardshipStatus: "none",
      approvals: {},
    },
    civicaid: { eligibility: "unchecked", estimatedFortnightlySupport: null, claim: "none", claimId: null, fields: [] },
    audit: [],
  };
  return append(state, now, "mission_started", "job_loss");
}

export function approvePassport(state: MissionState, now: number): MissionState {
  if (state.passport.approved) return state;
  return append(bump({ ...state, passport: { ...state.passport, approved: true } }), now, "passport_approved");
}

export function assertApproved(state: MissionState) {
  if (!state.passport.approved) throw new MissionError("PASSPORT_NOT_APPROVED", 403);
}

export function hasCapability(state: MissionState, capability: Capability) {
  return state.passport.approved && state.passport.scopes.brightenergy.includes(capability);
}

export function registeredCapabilities(state: MissionState): Capability[] {
  return state.passport.approved ? [...state.passport.scopes.brightenergy] : [];
}

export function assertCapability(state: MissionState, capability: Capability) {
  assertApproved(state);
  if (!hasCapability(state, capability)) {
    throw new MissionError("MISSION_SCOPE_DENIED", 403, {
      capability: `brightenergy.${capability}`,
    });
  }
}

export function grantChangePlan(state: MissionState, now: number): MissionState {
  assertApproved(state);
  if (hasCapability(state, CHANGE_PLAN_CAPABILITY)) return state;
  const scopes = [...state.passport.scopes.brightenergy, CHANGE_PLAN_CAPABILITY];
  const granted = bump({
    ...state,
    passport: { ...state.passport, scopes: { ...state.passport.scopes, brightenergy: scopes } },
  });
  return append(granted, now, "capability_granted", CHANGE_PLAN_CAPABILITY);
}

function invoke(state: MissionState, now: number, tool: Capability): MissionState {
  return append(state, now, "tool_invoked", tool);
}

function complete(state: MissionState, now: number, tool: Capability): MissionState {
  return append(state, now, "tool_completed", tool);
}

export function getAccountSummary(state: MissionState, now: number) {
  assertCapability(state, "get_account_summary");
  const next = complete(invoke(state, now, "get_account_summary"), now + 1, "get_account_summary");
  return {
    state: next,
    result: {
      plan: next.brightenergy.plan === "standard_flex" ? "Standard Flex" : "Saver Flex",
      estimatedMonthlyCost: next.brightenergy.estimatedMonthlyCost,
      hardshipStatus: next.brightenergy.hardshipStatus,
    },
  };
}

export function applyHardship(state: MissionState, now: number, program: unknown) {
  assertCapability(state, "apply_hardship");
  if (program !== "temporary_relief") throw new MissionError("INVALID_HARDSHIP_PROGRAM", 400);
  let next = invoke(state, now, "apply_hardship");
  next = bump({
    ...next,
    brightenergy: { ...next.brightenergy, hardshipStatus: "temporary_relief" },
  });
  next = complete(next, now + 1, "apply_hardship");
  return { state: next, result: { status: "applied", hardshipStatus: "temporary_relief" } };
}

export function requestPlanChange(state: MissionState, now: number, plan: unknown) {
  assertCapability(state, CHANGE_PLAN_CAPABILITY);
  if (plan !== "saver_flex") throw new MissionError("INVALID_PLAN", 400);
  const existing = Object.values(state.brightenergy.approvals).find(
    (approval) => approval.plan === plan && approval.completedAt === undefined,
  );
  if (existing) return { state, result: approvalResult(existing) };
  let next = invoke(state, now, CHANGE_PLAN_CAPABILITY);
  const approval: Approval = {
    id: `approval_${state.passport.missionId}_${state.passport.generation ?? "legacy"}_${state.passport.version}`,
    missionId: state.passport.missionId,
    requestedAt: now,
    expiresAt: now + 10 * 60 * 1000,
    plan,
  };
  next = bump({
    ...next,
    brightenergy: {
      ...next.brightenergy,
      approvals: { ...next.brightenergy.approvals, [approval.id]: approval },
    },
  });
  next = append(next, now + 1, "human_approval_requested", CHANGE_PLAN_CAPABILITY);
  return { state: next, result: approvalResult(approval) };
}

function approvalResult(approval: Approval): Record<string, unknown> {
  return {
    status: approval.approvedAt === undefined ? "awaiting_approval" : "approved",
    approvalId: approval.id,
    plan: { name: "Saver Flex", estimatedMonthlyCost: 115, estimatedMonthlySaving: 31 },
  };
}

export function approveAction(state: MissionState, now: number, approvalId: unknown) {
  if (typeof approvalId !== "string") throw new MissionError("APPROVAL_ID_REQUIRED", 400);
  const approval = state.brightenergy.approvals[approvalId];
  if (!approval || approval.missionId !== state.passport.missionId) {
    throw new MissionError("APPROVAL_NOT_FOUND", 404);
  }
  if (approval.expiresAt <= now) throw new MissionError("APPROVAL_EXPIRED", 409);
  if (approval.approvedAt !== undefined) return state;
  const approved = { ...approval, approvedAt: now };
  let next = bump({
    ...state,
    brightenergy: {
      ...state.brightenergy,
      approvals: { ...state.brightenergy.approvals, [approvalId]: approved },
    },
  });
  next = append(next, now, "human_approved", CHANGE_PLAN_CAPABILITY);
  return next;
}

export function completePlanChange(state: MissionState, now: number, approvalId: unknown) {
  assertCapability(state, CHANGE_PLAN_CAPABILITY);
  if (typeof approvalId !== "string") throw new MissionError("APPROVAL_ID_REQUIRED", 400);
  const approval = state.brightenergy.approvals[approvalId];
  if (!approval || approval.missionId !== state.passport.missionId) {
    throw new MissionError("APPROVAL_NOT_FOUND", 404);
  }
  if (approval.completedAt !== undefined) {
    return { state, result: { status: "completed", approvalId, plan: "Saver Flex", idempotent: true } };
  }
  if (approval.expiresAt <= now) throw new MissionError("APPROVAL_EXPIRED", 409);
  if (approval.approvedAt === undefined) throw new MissionError("APPROVAL_REQUIRED", 409);
  const completedApproval = { ...approval, completedAt: now };
  let next = bump({
    ...state,
    brightenergy: {
      plan: "saver_flex",
      estimatedMonthlyCost: 115,
      hardshipStatus: state.brightenergy.hardshipStatus,
      approvals: { ...state.brightenergy.approvals, [approvalId]: completedApproval },
    },
  });
  next = complete(next, now, CHANGE_PLAN_CAPABILITY);
  return {
    state: next,
    result: { status: "completed", approvalId, plan: "Saver Flex", estimatedMonthlyCost: 115, estimatedMonthlySaving: 31 },
  };
}
