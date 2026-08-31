import fs from "node:fs";
import assert from "node:assert/strict";
import { assertSecretFree, readFingerprints } from "./secret-audit.mjs";

const origins = {
  mission: "https://ruvel-phase1-mission-dhili.jmsd0811.chatgpt.site",
  civicaid: "https://ruvel-civicaid-dhili.jmsd0811.chatgpt.site",
  brightenergy: "https://ruvel-phase1-brightenergy-dhili.jmsd0811.chatgpt.site",
  nextstep: "https://ruvel-nextstep-dhili.jmsd0811.chatgpt.site",
};
const cookies = {};
const fingerprints = process.argv[2] === "verify" ? readFingerprints() : [];
async function call(site, route, data) {
  const response = await fetch(`${origins[site]}${route}`, {
    method: data === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(cookies[site] ? { Cookie: cookies[site] } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const text = await response.text();
  assertSecretFree(text, `${site} response`, fingerprints);
  assertSecretFree(JSON.stringify([...response.headers]), `${site} headers`, fingerprints);
  if (route === "/api/session") cookies[site] = response.headers.get("set-cookie")?.split(";")[0];
  return { status: response.status, body: JSON.parse(text) };
}
fs.mkdirSync("artifacts", { recursive: true });
if (process.argv[2] === "capture") {
  const created = await call("mission", "/api/reset", {}); assert.equal(created.status, 200);
  const approved = await call("mission", "/api/action", { missionId: created.body.missionId, action: "approve_passport" }); assert.equal(approved.status, 200);
  assert.equal(approved.body.state.passport.approved, true);
  fs.writeFileSync("artifacts/phase3-pre-rotation-control.json", JSON.stringify({ missionId: created.body.missionId, issuedAt: approved.body.state.passport.issuedAt, expiresAt: approved.body.state.passport.expiresAt, capturedAt: new Date().toISOString(), approvedBeforeRotation: true }, null, 2));
  console.log("Pre-rotation approved control mission captured; no signed token or secret recorded.");
} else if (process.argv[2] === "verify") {
  const old = JSON.parse(fs.readFileSync("artifacts/phase3-pre-rotation-control.json", "utf8"));
  // Start clean before acceptance checks. Never reset or rewrite the old control.
  const fresh = await call("mission", "/api/reset", {}); assert.equal(fresh.status, 200);
  assert.notEqual(fresh.body.missionId, old.missionId); assert.equal(fresh.body.state.passport.approved, false);
  const results = { cleanMissionCreated: true, freshApprovalRequired: true, oldPassportRejected: {}, newPassportAccepted: {}, serviceCalls: {}, oldControlUnexpiredAtCheck: Date.now() < old.expiresAt };
  for (const site of ["civicaid", "brightenergy", "nextstep"]) assert.equal((await call(site, "/api/session")).status, 200);
  const unapproved = await call("nextstep", "/api/action", { missionId: fresh.body.missionId, action: "register_profile" });
  assert.equal(unapproved.status, 403); assert.equal(unapproved.body.error, "PASSPORT_NOT_APPROVED");
  for (const site of Object.keys(origins)) {
    const rejected = await call(site, "/api/action", { missionId: old.missionId, action: "read_state" });
    assert.equal(rejected.status, 401); assert.equal(rejected.body.error, "PASSPORT_INVALID"); results.oldPassportRejected[site] = "401 PASSPORT_INVALID";
  }
  assert.equal((await call("mission", "/api/action", { missionId: fresh.body.missionId, action: "approve_passport" })).status, 200);
  for (const [site, action] of [["civicaid", "check_eligibility"], ["brightenergy", "get_account_summary"], ["nextstep", "register_profile"]]) {
    const accepted = await call(site, "/api/action", { missionId: fresh.body.missionId, action, input: {} });
    assert.equal(accepted.status, 200); assert.equal(accepted.body.state.passport.approved, true);
    results.newPassportAccepted[site] = "PASS"; results.serviceCalls[site] = "PASS";
  }
  const evidence = JSON.stringify({ ...results, verifiedAt: new Date().toISOString(), freshMissionId: fresh.body.missionId }, null, 2);
  assertSecretFree(evidence, "rotation evidence", fingerprints);
  fs.writeFileSync("artifacts/phase3-rotation-result.json", evidence);
  console.log(JSON.stringify(results));
} else throw new Error("Use capture before rotation, verify after all four deployments succeed");
