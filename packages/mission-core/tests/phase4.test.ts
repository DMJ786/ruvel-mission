import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleDurableRequest, type DurableEnv, type DurableSite } from "../src/durable-server";
import { D1MissionStore, type MissionDatabase } from "../src/storage";
import { deriveReceipt, partnerProgress } from "../src/receipt";
import type { DurableResponse } from "../src/types";
import { friendlyMissionError } from "../src/presentation";

const env: DurableEnv = {
  RUVEL_PASSPORT_SECRET: "phase4-signing-test-only", RUVEL_SERVICE_SECRET: "phase4-service-test-only",
  MISSION_ORIGIN: "https://mission.test", BRIGHTENERGY_ORIGIN: "https://bright.test", CIVICAID_ORIGIN: "https://civic.test", NEXTSTEP_ORIGIN: "https://next.test",
};
const sites = { mission: env.MISSION_ORIGIN!, brightenergy: env.BRIGHTENERGY_ORIGIN!, civicaid: env.CIVICAID_ORIGIN!, nextstep: env.NEXTSTEP_ORIGIN! };
let database: DatabaseSync, store: D1MissionStore, directory: string, now: number;
let cookies: Partial<Record<DurableSite, string>>;
function adapter(db: DatabaseSync): MissionDatabase {
  return { prepare(sql: string) {
    let values: (string | number | null)[] = [];
    const statement = { bind(...args: unknown[]) { values = args as typeof values; return statement; },
      async first<T>() { return (db.prepare(sql).get(...values) ?? null) as T | null; },
      async run() { return { meta: { changes: Number(db.prepare(sql).run(...values).changes) } }; } };
    return statement;
  } };
}
async function send(site: DurableSite, path: string, body?: unknown) {
  const request = new Request(`${sites[site]}${path}`, { method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(cookies[site] ? { Cookie: cookies[site]! } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const fetcher = ((input: RequestInfo | URL, init?: RequestInit) => handleDurableRequest(new Request(input, init), env, "mission", { store, now: ++now })) as typeof fetch;
  return handleDurableRequest(request, env, site, { store, fetcher, now: ++now });
}
async function action(site: DurableSite, missionId: string, action: string, input: Record<string, unknown> = {}) {
  const response = await send(site, "/api/action", { missionId, action, input });
  return { httpStatus: response.status, ...await response.json() as DurableResponse & { error?: string; blockers?: string[] } };
}
async function start() { return await (await send("mission", "/api/reset", {})).json() as DurableResponse; }
async function ready() {
  const created = await start(), id = created.missionId;
  await action("mission", id, "approve_passport");
  await action("civicaid", id, "check_eligibility"); await action("civicaid", id, "prepare_support_claim");
  await action("brightenergy", id, "get_account_summary"); await action("brightenergy", id, "apply_hardship", { program: "temporary_relief" });
  await action("brightenergy", id, "grant_change_plan");
  const pending = await action("brightenergy", id, "change_plan", { plan: "saver_flex" });
  await action("brightenergy", id, "approve_action", { approvalId: pending.result.approvalId });
  await action("brightenergy", id, "change_plan", { approvalId: pending.result.approvalId });
  await action("nextstep", id, "register_profile"); await action("nextstep", id, "match_roles", { limit: 3 });
  return id;
}
beforeEach(async () => {
  now = Date.now(); cookies = {}; directory = mkdtempSync(join(tmpdir(), "ruvel-phase4-test-"));
  database = new DatabaseSync(join(directory, "missions.sqlite")); store = new D1MissionStore(adapter(database)); await store.initialize();
  for (const site of ["civicaid", "brightenergy", "nextstep"] as const) cookies[site] = (await send(site, "/api/session")).headers.get("Set-Cookie")!.split(";")[0]!;
});
afterEach(() => { database.close(); rmSync(directory, { recursive: true }); });

describe("canonical completion and Mission Receipt", () => {
  it("requires approval and all three actual partner outcomes", async () => {
    const { missionId: id, state } = await start();
    expect((await action("mission", id, "complete_mission")).error).toBe("PASSPORT_NOT_APPROVED");
    expect(deriveReceipt(state, sites)).toBeNull();
    await action("mission", id, "approve_passport");
    const blocked = await action("mission", id, "complete_mission");
    expect(blocked.httpStatus).toBe(409); expect(blocked.blockers).toEqual(["CivicAid", "BrightEnergy", "NextStep"]);
    await action("civicaid", id, "check_eligibility"); await action("civicaid", id, "prepare_support_claim");
    const partial = await action("mission", id, "read_state");
    expect(partnerProgress(partial.state)).toEqual({ civicaid: true, brightenergy: false, nextstep: false });
    expect((await action("mission", id, "complete_mission")).blockers).toEqual(["BrightEnergy", "NextStep"]);
    expect(partial.receipt).toBeNull();
  });
  it("allows completion only at the hub, records the real time and is idempotent", async () => {
    const id = await ready();
    expect((await action("nextstep", id, "complete_mission")).error).toBe("ACTION_NOT_AVAILABLE");
    const first = await action("mission", id, "complete_mission");
    expect(first.httpStatus).toBe(200); expect(first.receipt?.completedAt).toBe(first.state.completion?.completedAt);
    expect(first.state.audit).toHaveLength(20);
    const duplicate = await action("mission", id, "complete_mission");
    expect(duplicate.result.idempotent).toBe(true); expect(duplicate.revision).toBe(first.revision); expect(duplicate.receipt).toEqual(first.receipt);
  });
  it("derives seven action records and three authority decisions, not twenty WebMCP actions", async () => {
    const id = await ready(); const completed = await action("mission", id, "complete_mission");
    expect(completed.receipt?.summary).toMatchObject({ organisations: 3, completed: 3, recordedToolActions: 7, authorityDecisions: 3, auditEvents: 20 });
    const state = structuredClone(completed.state);
    const extra = structuredClone(state.audit.find(event => event.kind === "tool_invoked")!); extra.id = "extra-recorded-call"; state.audit.push(extra);
    expect(deriveReceipt(state, sites)?.summary.recordedToolActions).toBe(8);
    state.audit.push(extra); expect(deriveReceipt(state, sites)?.summary.recordedToolActions).toBe(8);
    expect(completed.receipt?.summary.elapsedMs).toBe(completed.state.completion!.completedAt - completed.state.audit[0]!.at);
  });
  it("derives supported privacy metrics and declines to invent missing metadata", async () => {
    const completed = await action("mission", await ready(), "complete_mission");
    expect(completed.receipt?.privacy).toEqual({ identityBearingArguments: 0, invocationRecords: 7, qualified: true });
    const state = structuredClone(completed.state), call = state.audit.find(event => event.kind === "tool_invoked")!;
    call.redactedArgs = { name: "[REDACTED]" }; call.identifierArgumentCount = 1;
    expect(deriveReceipt(state, sites)?.privacy.identityBearingArguments).toBe(1);
    delete call.identifierArgumentCount;
    expect(deriveReceipt(state, sites)?.privacy).toMatchObject({ identityBearingArguments: null, qualified: false });
  });
  it("contains actual organisation outcomes and computes savings from the observed baseline", async () => {
    const completed = await action("mission", await ready(), "complete_mission");
    const receipt = completed.receipt!;
    expect(receipt.organisations.map(item => item.name)).toEqual(["CivicAid", "BrightEnergy", "NextStep"]);
    expect(receipt.organisations.every(item => item.complete)).toBe(true);
    expect(receipt.organisations[0]?.estimate).toBe(782); expect(receipt.organisations[1]?.estimate).toBe(31);
    expect(receipt.organisations[2]?.outcomes).toContain("3 demo opportunities identified");
    const state = structuredClone(completed.state);
    state.audit.find(event => event.kind === "tool_completed" && event.capability === "get_account_summary")!.resultSummary!.estimatedMonthlyCost = 160;
    expect(deriveReceipt(state, sites)?.organisations[1]?.estimate).toBe(45);
  });
  it("shows grant and independent approval with real timestamps, not a fake exposure time", async () => {
    const completed = await action("mission", await ready(), "complete_mission");
    const authority = completed.receipt!.authority;
    expect(authority.map(item => item.label)).toEqual(["Initially not granted", "Granted by human", "Capability made available by scope", "Agent requested Saver Flex", "Human approval requested", "Human approved", "Approved change completed"]);
    expect(authority[1]?.at).toBe(completed.state.audit.find(event => event.kind === "capability_granted")!.at);
    expect(authority[2]?.at).toBeNull(); expect(authority[2]?.note).toContain("not recorded");
    expect(authority[5]?.at).toBe(completed.state.audit.find(event => event.kind === "human_approved")!.at);
  });
  it("masks the bearer handle and excludes secrets, session values, approval IDs and raw identity", async () => {
    const completed = await action("mission", await ready(), "complete_mission");
    const state = structuredClone(completed.state), call = state.audit.find(event => event.kind === "tool_invoked")!;
    call.redactedArgs = { secret: "secret-do-not-leak", approvalId: Object.keys(state.brightenergy.approvals)[0], [state.passport.missionId]: "hidden" };
    call.resultSummary = { token: "secret-do-not-leak", customer: "Jamie Citizen", approvalId: Object.keys(state.brightenergy.approvals)[0] };
    const receipt = deriveReceipt(state, sites)!, text = JSON.stringify(receipt);
    expect(receipt.maskedMissionId).toBe(`m_••••${state.passport.missionId.slice(-4).toUpperCase()}`);
    for (const value of [state.passport.missionId, "secret-do-not-leak", "Jamie Citizen", state.passport.generation!, ...Object.keys(state.brightenergy.approvals)]) expect(text).not.toContain(value);
  });
  it("orders the human-readable timeline and keeps technical details secondary", async () => {
    const completed = await action("mission", await ready(), "complete_mission"), state = structuredClone(completed.state);
    state.audit.reverse();
    const receipt = deriveReceipt(state, sites)!;
    const times = receipt.timeline.map(item => item.at!); expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(receipt.timeline.at(-1)?.label).toBe("Mission completed");
    expect(receipt.timeline.some(item => item.label.includes("tool_completed"))).toBe(false);
    expect(receipt.technicalAudit).toHaveLength(20);
  });
  it("preserves the completed Receipt across database reopen and freezes outcomes until explicit reset", async () => {
    const id = await ready(), completed = await action("mission", id, "complete_mission");
    database.close(); database = new DatabaseSync(join(directory, "missions.sqlite")); store = new D1MissionStore(adapter(database));
    expect((await action("mission", id, "read_state")).receipt).toEqual(completed.receipt);
    expect((await action("nextstep", id, "match_roles", { limit: 1 })).error).toBe("MISSION_COMPLETED");
    const reset = await (await send("mission", "/api/reset", { missionId: id })).json() as DurableResponse;
    expect(reset.state.completion).toBeUndefined(); expect(deriveReceipt(reset.state, sites)).toBeNull();
    expect(reset.state.audit).toHaveLength(1); expect(reset.state.passport.approved).toBe(false);
    expect(Object.values(partnerProgress(reset.state))).toEqual([false, false, false]);
  });
  it("never renders a completed Receipt for inconsistent or unapproved state", async () => {
    const completed = await action("mission", await ready(), "complete_mission"), state = structuredClone(completed.state);
    state.nextstep.status = "active"; expect(deriveReceipt(state, sites)).toBeNull();
    state.nextstep.status = "completed"; state.passport.approved = false; expect(deriveReceipt(state, sites)).toBeNull();
    state.passport.approved = true; state.audit = state.audit.filter(event => event.kind !== "mission_completed"); expect(deriveReceipt(state, sites)).toBeNull();
  });
  it("presents concise recovery text without changing raw protocol errors", () => {
    expect(friendlyMissionError("PASSPORT_EXPIRED")).toContain("Reset Demo");
    expect(friendlyMissionError("PASSPORT_NOT_APPROVED")).toContain("Return to Mission");
    expect(friendlyMissionError("MISSION_SCOPE_DENIED: brightenergy.change_plan")).toContain("BrightEnergy hasn't granted");
    expect(friendlyMissionError("Unexpected token '<', not valid JSON")).toContain("unexpected response");
  });
});
