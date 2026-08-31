import type { MissionReceipt } from "./receipt";

export const BASE_CAPABILITIES = ["get_account_summary", "apply_hardship"] as const;
export const CHANGE_PLAN_CAPABILITY = "change_plan" as const;
export const CIVIC_CAPABILITIES = ["check_eligibility", "prepare_support_claim"] as const;
export type CivicCapability = (typeof CIVIC_CAPABILITIES)[number];
export const NEXTSTEP_CAPABILITIES = ["register_profile", "match_roles"] as const;
export type NextStepCapability = (typeof NEXTSTEP_CAPABILITIES)[number];
export type RoleMatch = { title: string; location: string; workMode: "Hybrid" | "Remote"; demo: true };
export type NextStepMissionState = {
  status: "not_started" | "active" | "completed";
  profileStatus: "not_registered" | "active";
  availability: "immediate";
  roleMatches: RoleMatch[];
};

export type Capability = (typeof BASE_CAPABILITIES)[number] | typeof CHANGE_PLAN_CAPABILITY;
export type AuditKind =
  | "mission_started"
  | "mission_completed"
  | "passport_approved"
  | "capability_granted"
  | "tool_invoked"
  | "tool_completed"
  | "human_approval_requested"
  | "human_approved";

export type AuditEvent = {
  id: string;
  at: number;
  kind: AuditKind;
  detail?: string;
  origin?: string;
  capability?: string;
  redactedArgs?: Record<string, unknown>;
  identifierArgumentCount?: number;
  resultSummary?: Record<string, unknown>;
};

export type MissionPassport = {
  missionId: string;
  version: number;
  generation?: string;
  issuedAt: number;
  expiresAt: number;
  approved: boolean;
  scopes: { brightenergy: Capability[]; civicaid: CivicCapability[]; nextstep: NextStepCapability[] };
  disclosures: { allowed: string[]; forbidden: string[] };
};

export type Approval = {
  id: string;
  missionId: string;
  requestedAt: number;
  expiresAt: number;
  approvedAt?: number;
  completedAt?: number;
  plan: "saver_flex";
};

export type MissionState = {
  completion?: { completedAt: number };
  passport: MissionPassport;
  brightenergy: {
    plan: "standard_flex" | "saver_flex";
    estimatedMonthlyCost: 146 | 115;
    hardshipStatus: "none" | "temporary_relief";
    approvals: Record<string, Approval>;
  };
  audit: AuditEvent[];
  nextstep: NextStepMissionState;
  civicaid: {
    eligibility: "unchecked" | "eligible";
    estimatedFortnightlySupport: number | null;
    claim: "none" | "prepared";
    claimId: string | null;
    fields: { key: string; label: string; value: string | null; source: string }[];
  };
};

export type ActionName =
  | "read_state"
  | "approve_passport"
  | "get_account_summary"
  | "apply_hardship"
  | "grant_change_plan"
  | "change_plan"
  | "approve_action";

export type DurableAction = ActionName | CivicCapability | NextStepCapability | "complete_mission";
export type DurableResponse = {
  missionId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  state: MissionState;
  result: Record<string, unknown>;
  sites: { mission: string; brightenergy: string; civicaid: string; nextstep: string };
  receipt?: MissionReceipt | null;
};

export type ActionRequest = {
  token: string;
  action: ActionName;
  input?: Record<string, unknown>;
};

export type ActionResponse = {
  token: string;
  state: MissionState;
  result: Record<string, unknown>;
};
