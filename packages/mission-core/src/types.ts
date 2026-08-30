export const BASE_CAPABILITIES = ["get_account_summary", "apply_hardship"] as const;
export const CHANGE_PLAN_CAPABILITY = "change_plan" as const;

export type Capability = (typeof BASE_CAPABILITIES)[number] | typeof CHANGE_PLAN_CAPABILITY;
export type AuditKind =
  | "mission_started"
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
};

export type MissionPassport = {
  missionId: string;
  version: number;
  issuedAt: number;
  expiresAt: number;
  approved: boolean;
  scopes: { brightenergy: Capability[] };
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
  passport: MissionPassport;
  brightenergy: {
    plan: "standard_flex" | "saver_flex";
    estimatedMonthlyCost: 146 | 115;
    hardshipStatus: "none" | "temporary_relief";
    approvals: Record<string, Approval>;
  };
  audit: AuditEvent[];
};

export type ActionName =
  | "read_state"
  | "approve_passport"
  | "get_account_summary"
  | "apply_hardship"
  | "grant_change_plan"
  | "change_plan"
  | "approve_action";

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
