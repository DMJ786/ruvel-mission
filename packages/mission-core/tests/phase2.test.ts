import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleDurableRequest, type DurableEnv, type DurableSite } from "../src/durable-server";
import { D1MissionStore, type MissionDatabase } from "../src/storage";
import { redactArguments } from "../src/civicaid";
import { signState, verifyState } from "../src/token";
import type { DurableResponse } from "../src/types";

const env: DurableEnv = {
  RUVEL_PASSPORT_SECRET: "test-passport-secret", RUVEL_SERVICE_SECRET: "test-service-secret",
  MISSION_ORIGIN: "https://mission.test", BRIGHTENERGY_ORIGIN: "https://bright.test", CIVICAID_ORIGIN: "https://civic.test",
  NEXTSTEP_ORIGIN: "https://next.test",
};
let database: DatabaseSync, store: D1MissionStore, directory: string, now: number;
let cookies: Record<string, string>;

function adapter(database: DatabaseSync): MissionDatabase {
  return { prepare(sql: string) {
    let values: (string | number | null)[] = [];
    const statement = {
      bind(...args: unknown[]) { values = args as typeof values; return statement; },
      async first<T>() { return (database.prepare(sql).get(...values) ?? null) as T | null; },
      async run() { return { meta: { changes: Number(database.prepare(sql).run(...values).changes) } }; },
    };
    return statement;
  } };
}
const origins = { mission: env.MISSION_ORIGIN!, brightenergy: env.BRIGHTENERGY_ORIGIN!, civicaid: env.CIVICAID_ORIGIN!, nextstep: env.NEXTSTEP_ORIGIN! };
async function send(site: DurableSite, path: string, body?: unknown, authenticated = true) {
  const request = new Request(`${origins[site]}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(authenticated && cookies[site] ? { Cookie: cookies[site] } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const fetcher = ((input: RequestInfo | URL, init?: RequestInit) => handleDurableRequest(new Request(input, init), env, "mission", { store, now: ++now })) as typeof fetch;
  return handleDurableRequest(request, env, site, { store, fetcher, now: ++now });
}
async function action(site: DurableSite, missionId: string, action: string, input: Record<string, unknown> = {}) {
  const response = await send(site, "/api/action", { missionId, action, input });
  const data = await response.json() as DurableResponse & { error?: string; capability?: string };
  return { status: response.status, ...data };
}
async function start() {
  const created = await (await send("mission", "/api/reset", {})).json() as DurableResponse;
  await action("mission", created.missionId, "approve_passport");
  return created.missionId;
}
beforeEach(async () => {
  now = Date.now(); cookies = {};
  directory = mkdtempSync(join(tmpdir(), "ruvel-phase2-test-"));
  database = new DatabaseSync(join(directory, "missions.sqlite"));
  store = new D1MissionStore(adapter(database)); await store.initialize();
  for (const site of ["civicaid", "brightenergy"] as const) {
    const session = await send(site, "/api/session");
    cookies[site] = session.headers.get("Set-Cookie")!.split(";")[0]!;
  }
});
afterEach(() => { database.close(); rmSync(directory, { recursive: true }); });

describe("durable migration and canonical authority", () => {
  it("issues only an opaque handle and no browser token", async () => {
    const created = await (await send("mission", "/api/reset", {})).json() as DurableResponse;
    expect(created.missionId).toMatch(/^m_[0-9a-f]{32}$/u);
    expect(created).not.toHaveProperty("token");
    expect(created.state.passport.missionId).toBe(created.missionId);
    expect(await store.get(created.missionId)).toHaveProperty("signedState");
  });
  it("rejects invalid and unknown handles and client-supplied state", async () => {
    expect((await action("mission", "job-loss-jamie", "read_state")).status).toBe(400);
    expect((await action("mission", `m_${"0".repeat(32)}`, "read_state")).status).toBe(404);
    const rejected = await send("mission", "/api/action", { token: "old-client-token", action: "read_state" });
    expect(rejected.status).toBe(400);
  });
  it("rejects unauthenticated internal requests and tampered canonical signatures", async () => {
    expect((await send("mission", "/api/internal", { site: "brightenergy", action: "resolve" })).status).toBe(403);
    const id = await start(), record = (await store.get(id))!;
    await store.save({ ...record, signedState: "bad.signature", revision: record.revision + 1 }, record.revision);
    expect((await action("brightenergy", id, "get_account_summary")).status).toBe(401);
  });
  it("prevents lost updates with an atomic revision check", async () => {
    const id = await start(), record = (await store.get(id))!;
    expect(await store.save({ ...record, revision: record.revision + 1 }, record.revision)).toBe(true);
    expect(await store.save({ ...record, revision: record.revision + 1 }, record.revision)).toBe(false);
  });
  it("keeps both partners after closing and reopening the database", async () => {
    const id = await start();
    await action("civicaid", id, "check_eligibility");
    await action("civicaid", id, "prepare_support_claim");
    await action("brightenergy", id, "apply_hardship", { program: "temporary_relief" });
    database.close(); database = new DatabaseSync(join(directory, "missions.sqlite")); store = new D1MissionStore(adapter(database));
    const hub = await action("mission", id, "read_state");
    expect(hub.state.civicaid.claim).toBe("prepared");
    expect(hub.state.brightenergy.hardshipStatus).toBe("temporary_relief");
    expect((await action("civicaid", id, "read_state")).state.brightenergy.hardshipStatus).toBe("temporary_relief");
  });
});

describe("CivicAid session and privacy", () => {
  it("requires its own signed-in demo session and rejects another site's cookie", async () => {
    const id = await start();
    expect((await send("civicaid", "/api/action", { missionId: id, action: "check_eligibility" }, false)).status).toBe(401);
    cookies.civicaid = cookies.brightenergy!;
    expect((await action("civicaid", id, "check_eligibility")).status).toBe(401);
  });
  it("resolves the masked fictional citizen in an HttpOnly site-local session", async () => {
    const response = await send("civicaid", "/api/session");
    expect(response.headers.get("Set-Cookie")).toContain("Secure; HttpOnly; SameSite=Lax");
    expect(await response.json()).toMatchObject({ demo: true, citizen: { displayName: "J. Citizen", reference: "•••• 2319" } });
  });
  it("checks eligibility and prepares exactly the represented fields with empty arguments", async () => {
    const id = await start();
    expect((await action("civicaid", id, "check_eligibility")).result).toMatchObject({ eligible: true, estimatedFortnightlySupport: 782, demo: true });
    const claim = await action("civicaid", id, "prepare_support_claim");
    expect(claim.result).toMatchObject({ status: "prepared", fieldsPrepared: 5, fieldsNeedingHumanInput: 1 });
    expect(claim.state.civicaid.fields).toHaveLength(6);
    const audit = claim.state.audit.filter(event => event.origin === origins.civicaid);
    expect(audit).toHaveLength(4);
    expect(audit.every(event => JSON.stringify(event.redactedArgs) === "{}" && event.identifierArgumentCount === 0)).toBe(true);
    expect(audit.every(event => event.resultSummary && event.at > 0 && event.capability)).toBe(true);
  });
  it("rejects identity arguments and redacts identifiers from audit metadata", async () => {
    const id = await start();
    expect((await action("civicaid", id, "check_eligibility", { name: "Never store this" })).status).toBe(400);
    expect(redactArguments({ name: "Never store this", customer_id: "secret", startFrom: "secret" })).toEqual({ redactedArgs: { name: "[REDACTED]", customer_id: "[REDACTED]", startFrom: "[REDACTED]" }, identifierArgumentCount: 2 });
  });
  it("enforces current CivicAid scope and authorised disclosure", async () => {
    const id = await start();
    expect((await action("civicaid", id, "prepare_support_claim")).error).toBe("ELIGIBILITY_CHECK_REQUIRED");
    expect((await action("brightenergy", id, "check_eligibility")).status).toBe(404);
    let record = (await store.get(id))!;
    let state = await verifyState(record.signedState, env.RUVEL_PASSPORT_SECRET!, now);
    state.passport.scopes.civicaid = [];
    await store.save({ ...record, revision: record.revision + 1, signedState: await signState(state, env.RUVEL_PASSPORT_SECRET!) }, record.revision);
    expect((await action("civicaid", id, "check_eligibility")).error).toBe("MISSION_SCOPE_DENIED");
    record = (await store.get(id))!;
    state = await verifyState(record.signedState, env.RUVEL_PASSPORT_SECRET!, now);
    state.passport.scopes.civicaid = ["check_eligibility", "prepare_support_claim"];
    state.passport.disclosures.allowed = [];
    await store.save({ ...record, revision: record.revision + 1, signedState: await signState(state, env.RUVEL_PASSPORT_SECRET!) }, record.revision);
    expect((await action("civicaid", id, "check_eligibility")).error).toBe("DISCLOSURE_DENIED");
  });
});

describe("BrightEnergy durable regression and reset", () => {
  it("preserves initial scopes, 403, 2→3, approval and duplicate completion", async () => {
    const id = await start();
    expect((await action("brightenergy", id, "read_state")).state.passport.scopes.brightenergy).toHaveLength(2);
    expect(await action("brightenergy", id, "change_plan", { plan: "saver_flex" })).toMatchObject({ status: 403, error: "MISSION_SCOPE_DENIED", capability: "brightenergy.change_plan" });
    expect((await action("brightenergy", id, "grant_change_plan")).state.passport.scopes.brightenergy).toHaveLength(3);
    const pending = await action("brightenergy", id, "change_plan", { plan: "saver_flex" });
    expect(pending.result.status).toBe("awaiting_approval");
    const input = { approvalId: pending.result.approvalId };
    expect((await action("brightenergy", id, "change_plan", input)).error).toBe("APPROVAL_REQUIRED");
    await action("brightenergy", id, "approve_action", input);
    const completed = await action("brightenergy", id, "change_plan", input);
    const duplicate = await action("brightenergy", id, "change_plan", input);
    expect(duplicate.result.idempotent).toBe(true);
    expect(duplicate.state.audit).toHaveLength(completed.state.audit.length);
  });
  it("resets both partners on the same handle and rejects stale grants and approvals", async () => {
    const id = await start();
    await action("civicaid", id, "check_eligibility"); await action("civicaid", id, "prepare_support_claim");
    await action("brightenergy", id, "grant_change_plan");
    const pending = await action("brightenergy", id, "change_plan", { plan: "saver_flex" });
    const reset = await (await send("mission", "/api/reset", { missionId: id })).json() as DurableResponse;
    expect(reset.missionId).toBe(id);
    expect(reset.state.civicaid).toMatchObject({ eligibility: "unchecked", claim: "none" });
    expect(reset.state.brightenergy).toMatchObject({ plan: "standard_flex", hardshipStatus: "none", approvals: {} });
    expect(reset.state.audit).toHaveLength(1);
    await action("mission", id, "approve_passport");
    expect((await action("brightenergy", id, "change_plan", { plan: "saver_flex" })).error).toBe("MISSION_SCOPE_DENIED");
    await action("brightenergy", id, "grant_change_plan");
    expect((await action("brightenergy", id, "change_plan", { approvalId: pending.result.approvalId })).error).toBe("APPROVAL_NOT_FOUND");
    const fresh = await action("brightenergy", id, "change_plan", { plan: "saver_flex" });
    expect(fresh.result.approvalId).not.toBe(pending.result.approvalId);
  });
});
