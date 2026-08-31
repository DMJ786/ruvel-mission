import { civicAction, civicDemoRecord, redactArguments } from "./civicaid";
import { nextStepAction, nextStepDemoRecord } from "./nextstep";
import { applyHardship, approveAction, approvePassport, completePlanChange, createInitialState, getAccountSummary, grantChangePlan, MissionError, requestPlanChange } from "./state";
import { assertMissionHandle, D1MissionStore, type MissionDatabase, type MissionStore, type StoredMission } from "./storage";
import { signPayload, signState, verifyPayload, verifyState } from "./token";
import type { DurableAction, DurableResponse, MissionState } from "./types";

export type DurableSite = "mission" | "brightenergy" | "civicaid" | "nextstep";
export type DurableEnv = {
  DB?: MissionDatabase;
  RUVEL_PASSPORT_SECRET?: string;
  RUVEL_SERVICE_SECRET?: string;
  MISSION_ORIGIN?: string;
  BRIGHTENERGY_ORIGIN?: string;
  CIVICAID_ORIGIN?: string;
  NEXTSTEP_ORIGIN?: string;
};
type Options = { store?: MissionStore; fetcher?: typeof fetch; now?: number };
type Input = { missionId?: string; action?: DurableAction | "reset" | "resolve"; input?: Record<string, unknown>; site?: DurableSite };

function json(value: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...extra } });
}
function configured(env: DurableEnv) {
  if (!env.RUVEL_PASSPORT_SECRET || !env.RUVEL_SERVICE_SECRET || !env.MISSION_ORIGIN || !env.BRIGHTENERGY_ORIGIN || !env.CIVICAID_ORIGIN || !env.NEXTSTEP_ORIGIN) throw new MissionError("SERVER_NOT_CONFIGURED", 503);
  return {
    secret: env.RUVEL_PASSPORT_SECRET,
    service: env.RUVEL_SERVICE_SECRET,
    sites: { mission: env.MISSION_ORIGIN, brightenergy: env.BRIGHTENERGY_ORIGIN, civicaid: env.CIVICAID_ORIGIN, nextstep: env.NEXTSTEP_ORIGIN },
  };
}

export async function makeDemoSession(site: DurableSite, secret: string, now: number) {
  return signPayload({ site, session: "fictional-seeded-account", expiresAt: now + 86_400_000 }, `${secret}:session:${site}`);
}
async function requireDemoSession(request: Request, site: DurableSite, secret: string, now: number) {
  const cookie = request.headers.get("Cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith("__Host-ruvel-demo="))?.split("=")[1];
  if (!cookie) throw new MissionError("DEMO_SESSION_REQUIRED", 401);
  const session = await verifyPayload(cookie, `${secret}:session:${site}`) as { site: string; session: string; expiresAt: number };
  if (session.site !== site || session.session !== "fictional-seeded-account" || session.expiresAt <= now) throw new MissionError("DEMO_SESSION_REQUIRED", 401);
}

function transition(site: DurableSite, state: MissionState, action: DurableAction, input: Record<string, unknown>, now: number) {
  if (action === "read_state") return { state, result: { status: "verified" } };
  if (site === "mission" && action === "approve_passport") return { state: approvePassport(state, now), result: { status: "approved" } };
  if (site === "civicaid" && (action === "check_eligibility" || action === "prepare_support_claim")) return civicAction(state, action, input, now);
  if (site === "nextstep" && (action === "register_profile" || action === "match_roles")) return nextStepAction(state, action, input, now);
  if (site === "brightenergy") {
    switch (action) {
      case "get_account_summary": return getAccountSummary(state, now);
      case "apply_hardship": return applyHardship(state, now, input.program);
      case "grant_change_plan": return { state: grantChangePlan(state, now), result: { status: "granted", capability: "brightenergy.change_plan" } };
      case "approve_action": return { state: approveAction(state, now, input.approvalId), result: { status: "approved", approvalId: input.approvalId } };
      case "change_plan": return input.approvalId === undefined ? requestPlanChange(state, now, input.plan) : completePlanChange(state, now, input.approvalId);
    }
  }
  throw new MissionError("ACTION_NOT_AVAILABLE", 404);
}

function initial(id: string, now: number, origin: string) {
  const state = createInitialState(now);
  state.passport.missionId = id;
  state.passport.generation = crypto.randomUUID();
  state.audit = [{ id: `event_${id}_${crypto.randomUUID()}`, at: now, kind: "mission_started", detail: "job_loss", origin }];
  return state;
}

export async function handleDurableRequest(request: Request, env: DurableEnv, site: DurableSite, options: Options = {}): Promise<Response> {
  try {
    const config = configured(env);
    const now = options.now ?? Date.now();
    const url = new URL(request.url);
    if (url.pathname === "/api/config" && request.method === "GET") return json({ sites: config.sites });
    if (url.pathname === "/api/session" && request.method === "GET" && site !== "mission") {
      const session = await makeDemoSession(site, config.secret, now);
      return json({ demo: true, signedIn: true, ...(site === "civicaid" ? { citizen: civicDemoRecord } : site === "nextstep" ? { citizen: nextStepDemoRecord } : { customer: "Jamie Citizen", account: "•••• 4417" }) }, 200,
        { "Set-Cookie": `__Host-ruvel-demo=${session}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400` });
    }
    if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    let body: Input;
    try { body = await request.json() as Input; } catch { throw new MissionError("INVALID_REQUEST", 400); }
    if (!body || typeof body !== "object" || "token" in body || "state" in body || "passport" in body) throw new MissionError("CLIENT_STATE_NOT_ACCEPTED", 400);
    if (body.input && (typeof body.input !== "object" || Array.isArray(body.input))) throw new MissionError("INVALID_ARGUMENTS", 400);
    const input = body.input ?? {};
    const internal = url.pathname === "/api/internal";
    if (!["/api/internal", "/api/reset", "/api/action"].includes(url.pathname)) return json({ error: "NOT_FOUND" }, 404);
    if (internal && (site !== "mission" || request.headers.get("X-Ruvel-Service") !== config.service)) throw new MissionError("SERVICE_UNAUTHORIZED", 403);
    const actor = internal ? body.site : site;
    if (actor !== "mission" && actor !== "brightenergy" && actor !== "civicaid" && actor !== "nextstep") throw new MissionError("INVALID_SITE", 400);
    const action = url.pathname === "/api/reset" ? "reset" : body.action;
    if (!action) throw new MissionError("ACTION_REQUIRED", 400);

    if (site !== "mission") {
      await requireDemoSession(request, site, config.secret, now);
      assertMissionHandle(body.missionId);
      const callCentral = async (operation: string) => {
        const response = await (options.fetcher ?? fetch)(`${config.sites.mission}/api/internal`, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Ruvel-Service": config.service },
          body: JSON.stringify({ missionId: body.missionId, action: operation, input, site }),
        });
        const value = await response.json() as { error?: string; capability?: string; record?: StoredMission } & DurableResponse;
        if (!response.ok) throw new MissionError(value.error ?? "MISSION_SERVICE_UNAVAILABLE", response.status, value.capability ? { capability: value.capability } : {});
        return value;
      };
      // Independently verify the canonical Passport before forwarding any operation.
      const resolved = await callCentral("resolve");
      if (!resolved.record) throw new MissionError("MISSION_SERVICE_UNAVAILABLE", 502);
      const canonical = action === "reset"
        ? await verifyPayload(resolved.record.signedState, config.secret) as MissionState
        : await verifyState(resolved.record.signedState, config.secret, now);
      if (canonical.passport.missionId !== body.missionId) throw new MissionError("PASSPORT_INVALID", 401);
      if (action !== "reset" && action !== "resolve") transition(site, canonical, action, input, now);
      const outcome = await callCentral(action);
      // Never expose the internal signed record to a browser.
      if (outcome.record) throw new MissionError("ACTION_NOT_AVAILABLE", 404);
      return json(outcome);
    }

    let store = options.store;
    if (!store) {
      if (!env.DB) throw new MissionError("DURABLE_STORAGE_UNAVAILABLE", 503);
      const d1 = new D1MissionStore(env.DB);
      await d1.initialize();
      store = d1;
    }
    if (action === "reset") {
      if (body.missionId !== undefined) assertMissionHandle(body.missionId);
      const id = body.missionId ?? `m_${crypto.randomUUID().replaceAll("-", "")}`;
      const previous = body.missionId ? await store.get(id) : null;
      if (body.missionId && !previous) throw new MissionError("MISSION_NOT_FOUND", 404);
      const state = initial(id, now, config.sites.mission);
      const record = { id, revision: (previous?.revision ?? 0) + 1, signedState: await signState(state, config.secret), createdAt: previous?.createdAt ?? new Date(now).toISOString(), updatedAt: new Date(now).toISOString() };
      if (previous) {
        if (!await store.save(record, previous.revision)) throw new MissionError("MISSION_CONFLICT_RETRY", 409);
      } else await store.create(record);
      return json({ missionId: id, revision: record.revision, createdAt: record.createdAt, updatedAt: record.updatedAt, state, result: { status: "reset" }, sites: config.sites });
    }
    assertMissionHandle(body.missionId);
    const record = await store.get(body.missionId);
    if (!record) throw new MissionError("MISSION_NOT_FOUND", 404);
    if (action === "resolve" && internal) return json({ record });
    if (action === "resolve") throw new MissionError("ACTION_NOT_AVAILABLE", 404);
    const state = await verifyState(record.signedState, config.secret, now);
    if (state.passport.missionId !== body.missionId) throw new MissionError("PASSPORT_INVALID", 401);
    const outcome = transition(actor, state, action, input, now);
    let revision = record.revision;
    let updatedAt = record.updatedAt;
    if (outcome.state !== state) {
      const metadata = redactArguments(input);
      outcome.state.audit = outcome.state.audit.map((event, index) => index < state.audit.length ? event : {
        ...event, at: now, origin: config.sites[actor], capability: event.detail ?? action,
        ...metadata, resultSummary: outcome.result,
      });
      revision += 1;
      updatedAt = new Date(now).toISOString();
      if (!await store.save({ ...record, revision, updatedAt, signedState: await signState(outcome.state, config.secret) }, record.revision)) throw new MissionError("MISSION_CONFLICT_RETRY", 409);
    }
    return json({ missionId: record.id, revision, createdAt: record.createdAt, updatedAt, state: outcome.state, result: outcome.result, sites: config.sites });
  } catch (error) {
    if (error instanceof MissionError) return json({ error: error.code, ...error.detail }, error.status);
    console.error("Mission request failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
}
