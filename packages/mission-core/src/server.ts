import {
  applyHardship,
  approveAction,
  approvePassport,
  completePlanChange,
  createInitialState,
  getAccountSummary,
  grantChangePlan,
  MissionError,
  requestPlanChange,
} from "./state";
import { signState, verifyState } from "./token";
import type { ActionRequest, ActionResponse, MissionState } from "./types";

export type WorkerEnv = { RUVEL_PASSPORT_SECRET?: string };
export type SiteKind = "mission" | "brightenergy";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function requireSecret(env: WorkerEnv) {
  if (!env.RUVEL_PASSPORT_SECRET) throw new MissionError("SERVER_NOT_CONFIGURED", 500);
  return env.RUVEL_PASSPORT_SECRET;
}

async function response(state: MissionState, result: Record<string, unknown>, secret: string): Promise<ActionResponse> {
  return { token: await signState(state, secret), state, result };
}

export async function handleApiRequest(request: Request, env: WorkerEnv, site: SiteKind, now = Date.now()) {
  try {
    if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    const secret = requireSecret(env);
    const path = new URL(request.url).pathname;
    if (path === "/api/reset") {
      return json(await response(createInitialState(now), { status: "reset" }, secret));
    }
    if (path !== "/api/action") return json({ error: "NOT_FOUND" }, 404);
    const body = (await request.json()) as ActionRequest;
    const state = await verifyState(body.token, secret, now);
    const input = body.input ?? {};

    if (body.action === "read_state") return json(await response(state, { status: "verified" }, secret));
    if (body.action === "approve_passport" && site === "mission") {
      const next = approvePassport(state, now);
      return json(await response(next, { status: "approved" }, secret));
    }
    if (site !== "brightenergy") throw new MissionError("ACTION_NOT_AVAILABLE", 404);

    if (body.action === "get_account_summary") {
      const outcome = getAccountSummary(state, now);
      return json(await response(outcome.state, outcome.result, secret));
    }
    if (body.action === "apply_hardship") {
      const outcome = applyHardship(state, now, input.program);
      return json(await response(outcome.state, outcome.result, secret));
    }
    if (body.action === "grant_change_plan") {
      const next = grantChangePlan(state, now);
      return json(await response(next, { status: "granted", capability: "brightenergy.change_plan" }, secret));
    }
    if (body.action === "approve_action") {
      const next = approveAction(state, now, input.approvalId);
      return json(await response(next, { status: "approved", approvalId: input.approvalId }, secret));
    }
    if (body.action === "change_plan") {
      const outcome = input.approvalId === undefined
        ? requestPlanChange(state, now, input.plan)
        : completePlanChange(state, now, input.approvalId);
      return json(await response(outcome.state, outcome.result, secret));
    }
    throw new MissionError("ACTION_NOT_AVAILABLE", 404);
  } catch (error) {
    if (error instanceof MissionError) return json({ error: error.code, ...error.detail }, error.status);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
}
