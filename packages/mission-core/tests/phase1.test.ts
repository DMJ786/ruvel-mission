import { describe, expect, it } from "vitest";
import {
  approveAction,
  approvePassport,
  completePlanChange,
  createInitialState,
  grantChangePlan,
  handleApiRequest,
  registeredCapabilities,
  requestPlanChange,
  signState,
  verifyState,
  type ActionResponse,
  type MissionState,
} from "../src/index";

const secret = "phase-1-test-secret-with-enough-entropy";
const start = Date.UTC(2026, 7, 31, 0, 0, 0);

async function action(state: MissionState, name: string, input: Record<string, unknown>, now = start + 10) {
  const request = new Request("https://bright.test/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: await signState(state, secret), action: name, input }),
  });
  return handleApiRequest(request, { RUVEL_PASSPORT_SECRET: secret }, "brightenergy", now);
}

async function payload(response: Response) {
  return response.json() as Promise<ActionResponse & { error?: string; capability?: string }>;
}

describe("Mission Passport", () => {
  it("accepts a valid signed token", async () => {
    const state = createInitialState(start);
    expect(await verifyState(await signState(state, secret), secret, start + 1)).toEqual(state);
  });

  it("rejects an expired token", async () => {
    const state = createInitialState(start);
    await expect(verifyState(await signState(state, secret), secret, state.passport.expiresAt)).rejects.toMatchObject({ message: "PASSPORT_EXPIRED" });
  });

  it("rejects a missing plan-change scope and accepts the grant", () => {
    const approved = approvePassport(createInitialState(start), start + 1);
    expect(() => requestPlanChange(approved, start + 2, "saver_flex")).toThrow("MISSION_SCOPE_DENIED");
    expect(requestPlanChange(grantChangePlan(approved, start + 2), start + 3, "saver_flex").result.status).toBe("awaiting_approval");
  });
});

describe("dynamic registration", () => {
  it("has exactly two initial capabilities and adds change_plan after grant", () => {
    const approved = approvePassport(createInitialState(start), start + 1);
    expect(registeredCapabilities(approved)).toEqual(["get_account_summary", "apply_hardship"]);
    expect(registeredCapabilities(grantChangePlan(approved, start + 2))).toEqual(["get_account_summary", "apply_hardship", "change_plan"]);
  });
});

describe("BrightEnergy server enforcement", () => {
  it("returns the required 403 response before grant", async () => {
    const response = await action(approvePassport(createInitialState(start), start + 1), "change_plan", { plan: "saver_flex" });
    expect(response.status).toBe(403);
    expect(await payload(response)).toMatchObject({ error: "MISSION_SCOPE_DENIED", capability: "brightenergy.change_plan" });
  });

  it("cannot complete without approval, completes after approval, and is idempotent", async () => {
    let state = grantChangePlan(approvePassport(createInitialState(start), start + 1), start + 2);
    const requested = requestPlanChange(state, start + 3, "saver_flex");
    state = requested.state;
    const approvalId = requested.result.approvalId as string;
    expect(() => completePlanChange(state, start + 4, approvalId)).toThrow("APPROVAL_REQUIRED");
    state = approveAction(state, start + 5, approvalId);
    const completed = completePlanChange(state, start + 6, approvalId);
    expect(completed.state.brightenergy).toMatchObject({ plan: "saver_flex", estimatedMonthlyCost: 115 });
    expect(completePlanChange(completed.state, start + 7, approvalId).result).toMatchObject({ status: "completed", idempotent: true });
  });
});

describe("navigation state and reset", () => {
  it("round-trips BrightEnergy mutations through the signed envelope for the hub", async () => {
    let state = grantChangePlan(approvePassport(createInitialState(start), start + 1), start + 2);
    const hardshipResponse = await action(state, "apply_hardship", { program: "temporary_relief" }, start + 3);
    state = (await payload(hardshipResponse)).state;
    const requested = requestPlanChange(state, start + 4, "saver_flex");
    const approvalId = requested.result.approvalId as string;
    state = completePlanChange(approveAction(requested.state, start + 5, approvalId), start + 6, approvalId).state;
    const carried = await signState(state, secret);
    const hubState = await verifyState(carried, secret, start + 7);
    expect(hubState.brightenergy).toMatchObject({ plan: "saver_flex", estimatedMonthlyCost: 115, hardshipStatus: "temporary_relief" });
  });

  it("reset restores plan, removes the grant and approvals, and restores the initial surface", async () => {
    const reset = await handleApiRequest(new Request("https://mission.test/api/reset", { method: "POST" }), { RUVEL_PASSPORT_SECRET: secret }, "mission", start + 20);
    const state = (await payload(reset)).state;
    expect(state.brightenergy).toMatchObject({ plan: "standard_flex", estimatedMonthlyCost: 146, hardshipStatus: "none", approvals: {} });
    expect(state.passport.scopes.brightenergy).toEqual(["get_account_summary", "apply_hardship"]);
    expect(registeredCapabilities(approvePassport(state, start + 21))).toHaveLength(2);
  });
});

describe("golden path reducer", () => {
  it.each([1, 2, 3])("completes deterministic run %i", () => {
    let state = approvePassport(createInitialState(start), start + 1);
    state = grantChangePlan(state, start + 2);
    const request = requestPlanChange(state, start + 3, "saver_flex");
    const id = request.result.approvalId as string;
    state = completePlanChange(approveAction(request.state, start + 4, id), start + 5, id).state;
    expect(state.brightenergy.plan).toBe("saver_flex");
    expect(state.audit.map((item) => `${item.kind}${item.detail ? `:${item.detail}` : ""}`)).toEqual(expect.arrayContaining([
      "mission_started:job_loss",
      "passport_approved",
      "capability_granted:change_plan",
      "tool_invoked:change_plan",
      "human_approval_requested:change_plan",
      "human_approved:change_plan",
      "tool_completed:change_plan",
    ]));
  });
});
