import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleDurableRequest, makeDemoSession, type DurableEnv, type DurableSite } from "../src/durable-server";
import { D1MissionStore, type MissionDatabase } from "../src/storage";
import { nextStepToolDefinition } from "../src/nextstep-tools";
import { NEXTSTEP_CAPABILITIES, type DurableResponse, type MissionState } from "../src/types";
import { signState, verifyState } from "../src/token";
import { redactArguments } from "../src/civicaid";

const env: DurableEnv = {
  RUVEL_PASSPORT_SECRET: "phase3-test-signing-only", RUVEL_SERVICE_SECRET: "phase3-test-service-only",
  MISSION_ORIGIN: "https://mission.test", BRIGHTENERGY_ORIGIN: "https://bright.test", CIVICAID_ORIGIN: "https://civic.test", NEXTSTEP_ORIGIN: "https://next.test",
};
const origins = { mission: env.MISSION_ORIGIN!, brightenergy: env.BRIGHTENERGY_ORIGIN!, civicaid: env.CIVICAID_ORIGIN!, nextstep: env.NEXTSTEP_ORIGIN! };
let database: DatabaseSync, store: D1MissionStore, directory: string, now: number;
let cookies: Partial<Record<DurableSite, string>>;
function adapter(db: DatabaseSync): MissionDatabase {
  return { prepare(sql: string) {
    let values: (string | number | null)[] = [];
    const statement = {
      bind(...args: unknown[]) { values = args as typeof values; return statement; },
      async first<T>() { return (db.prepare(sql).get(...values) ?? null) as T | null; },
      async run() { return { meta: { changes: Number(db.prepare(sql).run(...values).changes) } }; },
    };
    return statement;
  } };
}
async function send(site: DurableSite, path: string, body?: unknown) {
  const request = new Request(`${origins[site]}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(cookies[site] ? { Cookie: cookies[site]! } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const fetcher = ((input: RequestInfo | URL, init?: RequestInit) => handleDurableRequest(new Request(input, init), env, "mission", { store, now: ++now })) as typeof fetch;
  return handleDurableRequest(request, env, site, { store, fetcher, now: ++now });
}
async function action(site: DurableSite, missionId: string, action: string, input: Record<string, unknown> = {}) {
  const response = await send(site, "/api/action", { missionId, action, input });
  return { httpStatus: response.status, ...await response.json() as DurableResponse & { error?: string; capability?: string } };
}
async function start(approve = true) {
  const created = await (await send("mission", "/api/reset", {})).json() as DurableResponse;
  if (approve) await action("mission", created.missionId, "approve_passport");
  return created.missionId;
}
async function changeCanonical(id: string, change: (state: MissionState) => void) {
  const record = (await store.get(id))!;
  const state = await verifyState(record.signedState, env.RUVEL_PASSPORT_SECRET!, now);
  change(state);
  await store.save({ ...record, revision: record.revision + 1, signedState: await signState(state, env.RUVEL_PASSPORT_SECRET!) }, record.revision);
}
beforeEach(async () => {
  now = Date.now(); cookies = {};
  directory = mkdtempSync(join(tmpdir(), "ruvel-phase3-test-"));
  database = new DatabaseSync(join(directory, "missions.sqlite")); store = new D1MissionStore(adapter(database)); await store.initialize();
  for (const site of ["civicaid", "brightenergy", "nextstep"] as const) {
    cookies[site] = (await send(site, "/api/session")).headers.get("Set-Cookie")!.split(";")[0]!;
  }
});
afterEach(() => { database.close(); rmSync(directory, { recursive: true }); });

describe("NextStep's bounded partner contract", () => {
  it("defines exactly two minimal-input tools with a read-only role-search annotation", () => {
    const definitions = NEXTSTEP_CAPABILITIES.map(name => nextStepToolDefinition(name, async () => ({})));
    expect(definitions.map(tool => tool.name)).toEqual(["register_profile", "match_roles"]);
    expect(definitions[0]?.inputSchema).toEqual({ type: "object", properties: {}, additionalProperties: false });
    expect(definitions[1]?.annotations).toEqual({ readOnlyHint: true });
    expect(definitions[1]?.inputSchema).toMatchObject({ additionalProperties: false, properties: { limit: { minimum: 1, maximum: 3 } } });
  });
  it("resolves its fictional citizen using a signed, Secure, HttpOnly local session", async () => {
    const response = await send("nextstep", "/api/session");
    expect(response.headers.get("Set-Cookie")).toContain("Secure; HttpOnly; SameSite=Lax");
    expect(await response.json()).toMatchObject({ demo: true, signedIn: true, citizen: { displayName: "J. Citizen", preferredArea: "Sydney", rolePreference: "Software / technology" } });
  });
  it("rejects missing, other-partner, tampered and expired sessions", async () => {
    const id = await start();
    for (const cookie of [undefined, cookies.civicaid, cookies.brightenergy, "__Host-ruvel-demo=bad.signature", `__Host-ruvel-demo=${await makeDemoSession("nextstep", env.RUVEL_PASSPORT_SECRET!, now - 86_400_001)}`]) {
      if (cookie) cookies.nextstep = cookie; else delete cookies.nextstep;
      expect((await action("nextstep", id, "register_profile")).httpStatus).toBe(401);
    }
  });
  it("includes NextStep scopes without granting BrightEnergy change_plan", async () => {
    const id = await start(false);
    const state = (await action("mission", id, "read_state")).state;
    expect(state.passport.scopes.nextstep).toEqual(["register_profile", "match_roles"]);
    expect(state.passport.scopes.brightenergy).toEqual(["get_account_summary", "apply_hardship"]);
    expect((await action("nextstep", id, "register_profile")).error).toBe("PASSPORT_NOT_APPROVED");
  });
  it("registers with empty arguments and returns three clearly fictional opportunities", async () => {
    const id = await start();
    const registered = await action("nextstep", id, "register_profile");
    expect(registered.result).toEqual({ status: "registered", profileStatus: "active", demo: true });
    expect(registered.state.nextstep).toMatchObject({ status: "active", profileStatus: "active", availability: "immediate", roleMatches: [] });
    const matched = await action("nextstep", id, "match_roles", { limit: 3 });
    expect(matched.state.nextstep.status).toBe("completed");
    expect(matched.state.nextstep.roleMatches.map(role => role.title)).toEqual(["AI Platform Engineer", "Senior Software Engineer", "Cloud Engineering Lead"]);
    expect(matched.state.nextstep.roleMatches.every(role => role.demo)).toBe(true);
    expect(matched.state.nextstep.profileStatus).toBe(registered.state.nextstep.profileStatus);
    expect(matched.state.nextstep.availability).toBe(registered.state.nextstep.availability);
    expect(matched.state.brightenergy.approvals).toEqual({});
  });
  it("requires a profile, rejects unnecessary arguments and bounds the match limit", async () => {
    const id = await start();
    expect((await action("nextstep", id, "match_roles")).error).toBe("PROFILE_REQUIRED");
    for (const input of [{ name: "Fictional unwanted name" }, { email: "demo@example.invalid" }, { availability: "immediate" }]) {
      expect((await action("nextstep", id, "register_profile", input)).error).toBe("UNEXPECTED_TOOL_ARGUMENTS");
    }
    await action("nextstep", id, "register_profile");
    expect((await action("nextstep", id, "match_roles", { limit: 3, customer_id: "demo_only" })).error).toBe("UNEXPECTED_TOOL_ARGUMENTS");
    for (const limit of [0, 4, -1, 1.5, "3"]) expect((await action("nextstep", id, "match_roles", { limit })).error).toBe("INVALID_ROLE_LIMIT");
    expect((await action("nextstep", id, "match_roles")).state.nextstep.roleMatches).toHaveLength(3);
  });
  it("enforces current partner scope, disclosure and origin ownership", async () => {
    const id = await start();
    await action("nextstep", id, "register_profile");
    await changeCanonical(id, state => { state.passport.scopes.nextstep = ["register_profile"]; });
    expect(await action("nextstep", id, "match_roles", { limit: 3 })).toMatchObject({ httpStatus: 403, error: "MISSION_SCOPE_DENIED", capability: "nextstep.match_roles" });
    expect((await action("brightenergy", id, "register_profile")).httpStatus).toBe(404);
    expect((await action("nextstep", id, "grant_change_plan")).httpStatus).toBe(404);
    await changeCanonical(id, state => { state.passport.disclosures.allowed = []; });
    expect((await action("nextstep", id, "register_profile")).error).toBe("DISCLOSURE_DENIED");
  });
  it("records exactly one event pair per new outcome with real origin and safe arguments", async () => {
    const id = await start();
    await action("nextstep", id, "register_profile");
    await action("nextstep", id, "register_profile");
    const matched = await action("nextstep", id, "match_roles", { limit: 3 });
    const duplicate = await action("nextstep", id, "match_roles", { limit: 3 });
    expect(duplicate.revision).toBe(matched.revision);
    expect(duplicate.result).toEqual(matched.result);
    const events = duplicate.state.audit.filter(event => event.origin === origins.nextstep);
    expect(events).toHaveLength(4);
    expect(events.map(event => `${event.kind}:${event.capability}`)).toEqual(["tool_invoked:register_profile", "tool_completed:register_profile", "tool_invoked:match_roles", "tool_completed:match_roles"]);
    expect(new Set(events.map(event => event.id)).size).toBe(4);
    expect(events.every(event => event.at > 0 && event.resultSummary && event.identifierArgumentCount === 0)).toBe(true);
    expect(events[0]?.redactedArgs).toEqual({}); expect(events[2]?.redactedArgs).toEqual({ limit: 3 });
    expect(redactArguments({ email: "demo@example.invalid", limit: 3 })).toEqual({ redactedArgs: { email: "[REDACTED]", limit: 3 }, identifierArgumentCount: 1 });
  });
  it("does not silently extend an approved Phase 2 Passport", async () => {
    const id = await start();
    await changeCanonical(id, state => { Reflect.deleteProperty(state, "nextstep"); Reflect.deleteProperty(state.passport.scopes, "nextstep"); });
    expect((await action("mission", id, "read_state")).httpStatus).toBe(200);
    expect((await action("nextstep", id, "register_profile")).error).toBe("MISSION_SCOPE_DENIED");
    expect((await action("brightenergy", id, "get_account_summary")).httpStatus).toBe(200);
    await send("mission", "/api/reset", { missionId: id }); await action("mission", id, "approve_passport");
    expect((await action("nextstep", id, "register_profile")).httpStatus).toBe(200);
  });
});

describe("three-partner durability and reset", () => {
  it("A: rejects pre-rotation Passports and the old service credential without re-signing", async () => {
    const id = await start(), original = (await store.get(id))!;
    const rotated = { ...env, RUVEL_PASSPORT_SECRET: "new-unit-signing-key", RUVEL_SERVICE_SECRET: "new-unit-service-key" };
    await expect(verifyState(original.signedState, rotated.RUVEL_PASSPORT_SECRET, now)).rejects.toMatchObject({ code: "PASSPORT_INVALID" });
    const oldService = await handleDurableRequest(new Request(`${origins.mission}/api/internal`, { method: "POST", headers: { "Content-Type": "application/json", "X-Ruvel-Service": env.RUVEL_SERVICE_SECRET! }, body: JSON.stringify({ missionId: id, action: "resolve", site: "nextstep" }) }), rotated, "mission", { store, now });
    expect(oldService.status).toBe(403);
    for (const site of ["mission", "civicaid", "brightenergy", "nextstep"] as const) {
      const cookie = await makeDemoSession(site, rotated.RUVEL_PASSPORT_SECRET, now);
      const fetcher = ((input: RequestInfo | URL, init?: RequestInit) => handleDurableRequest(new Request(input, init), rotated, "mission", { store, now })) as typeof fetch;
      const response = await handleDurableRequest(new Request(`${origins[site]}/api/action`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `__Host-ruvel-demo=${cookie}` }, body: JSON.stringify({ missionId: id, action: "read_state" }) }), rotated, site, { store, now, fetcher });
      expect(response.status).toBe(401); expect(await response.json()).toEqual({ error: "PASSPORT_INVALID" });
    }
    expect(await store.get(id)).toEqual(original);
  });
  it("B: accepts a fresh approved Passport at all partners with the rotated service credential", async () => {
    const oldId = await start();
    const rotated = { ...env, RUVEL_PASSPORT_SECRET: "new-unit-signing-key", RUVEL_SERVICE_SECRET: "new-unit-service-key" };
    const invokeRotated = async (site: DurableSite, path: string, body: unknown) => {
      const cookie = await makeDemoSession(site, rotated.RUVEL_PASSPORT_SECRET, now);
      const fetcher = ((input: RequestInfo | URL, init?: RequestInit) => handleDurableRequest(new Request(input, init), rotated, "mission", { store, now })) as typeof fetch;
      return handleDurableRequest(new Request(`${origins[site]}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `__Host-ruvel-demo=${cookie}` }, body: JSON.stringify(body) }), rotated, site, { store, now, fetcher });
    };
    const fresh = await (await invokeRotated("mission", "/api/reset", {})).json() as DurableResponse;
    expect(fresh.missionId).not.toBe(oldId); expect(fresh.state.passport.approved).toBe(false);
    expect((await invokeRotated("nextstep", "/api/action", { missionId: fresh.missionId, action: "register_profile" })).status).toBe(403);
    await invokeRotated("mission", "/api/action", { missionId: fresh.missionId, action: "approve_passport" });
    for (const [site, capability] of [["civicaid", "check_eligibility"], ["brightenergy", "get_account_summary"], ["nextstep", "register_profile"]] as const) {
      const response = await invokeRotated(site, "/api/action", { missionId: fresh.missionId, action: capability, input: {} });
      expect(response.status).toBe(200);
      expect((await response.json() as DurableResponse).state.passport.approved).toBe(true);
    }
  });
  it("preserves all three organisations after database reopen and partner re-entry", async () => {
    const id = await start();
    await action("civicaid", id, "check_eligibility"); await action("civicaid", id, "prepare_support_claim");
    await action("brightenergy", id, "get_account_summary"); await action("brightenergy", id, "apply_hardship", { program: "temporary_relief" });
    expect((await action("brightenergy", id, "change_plan", { plan: "saver_flex" })).error).toBe("MISSION_SCOPE_DENIED");
    await action("brightenergy", id, "grant_change_plan");
    const pending = await action("brightenergy", id, "change_plan", { plan: "saver_flex" });
    const input = { approvalId: pending.result.approvalId };
    expect((await action("brightenergy", id, "change_plan", input)).error).toBe("APPROVAL_REQUIRED");
    await action("brightenergy", id, "approve_action", input); await action("brightenergy", id, "change_plan", input);
    await action("nextstep", id, "register_profile"); await action("nextstep", id, "match_roles", { limit: 3 });
    database.close(); database = new DatabaseSync(join(directory, "missions.sqlite")); store = new D1MissionStore(adapter(database));
    for (const site of ["mission", "civicaid", "brightenergy", "nextstep"] as const) {
      const restored = await action(site, id, "read_state");
      expect(restored.state.civicaid.claim).toBe("prepared"); expect(restored.state.brightenergy.plan).toBe("saver_flex"); expect(restored.state.nextstep.roleMatches).toHaveLength(3);
      expect(restored.state.audit).toHaveLength(19);
      expect(new Set(restored.state.audit.map(event => event.origin))).toEqual(new Set(Object.values(origins)));
    }
  });
  it("resets all three from the partner site on the same durable handle", async () => {
    const id = await start();
    await action("civicaid", id, "check_eligibility"); await action("civicaid", id, "prepare_support_claim");
    await action("brightenergy", id, "apply_hardship", { program: "temporary_relief" }); await action("brightenergy", id, "grant_change_plan");
    await action("brightenergy", id, "change_plan", { plan: "saver_flex" });
    await action("nextstep", id, "register_profile"); await action("nextstep", id, "match_roles", { limit: 3 });
    const reset = await (await send("nextstep", "/api/reset", { missionId: id })).json() as DurableResponse;
    expect(reset.missionId).toBe(id); expect(reset.state.passport.approved).toBe(false); expect(reset.state.audit).toHaveLength(1);
    expect(reset.state.nextstep).toMatchObject({ status: "not_started", profileStatus: "not_registered", roleMatches: [] });
    expect(reset.state.civicaid).toMatchObject({ eligibility: "unchecked", claim: "none" });
    expect(reset.state.brightenergy).toMatchObject({ plan: "standard_flex", hardshipStatus: "none", approvals: {} });
    await action("mission", id, "approve_passport");
    expect((await action("brightenergy", id, "change_plan", { plan: "saver_flex" })).error).toBe("MISSION_SCOPE_DENIED");
    expect((await action("nextstep", id, "match_roles", { limit: 3 })).error).toBe("PROFILE_REQUIRED");
    const state = (await action("mission", id, "read_state")).state;
    expect(Object.values(state.passport.scopes).map(scopes => scopes.length)).toEqual([2, 2, 2]);
  });
});
