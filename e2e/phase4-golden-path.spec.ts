import { expect, test, type Page } from "@playwright/test";
import { assertSecretFree, readFingerprints } from "../scripts/secret-audit.mjs";

type Tool = { name: string; annotations?: { readOnlyHint?: boolean }; execute(input: Record<string, unknown>): Promise<Record<string, unknown>> };
async function harness(page: Page) {
  await page.addInitScript(() => {
    const tools = new Map<string, Tool>();
    Object.defineProperty(window, "__phase4Tools", { value: tools });
    Object.defineProperty(document, "modelContext", { value: {
      async registerTool(tool: Tool, options?: { signal?: AbortSignal }) {
        tools.set(tool.name, tool);
        options?.signal?.addEventListener("abort", () => tools.delete(tool.name), { once: true });
      },
    } });
  });
}
async function invoke(page: Page, name: string, input: Record<string, unknown> = {}) {
  return page.evaluate(async ({ name, input }) => {
    const tool = (window as unknown as { __phase4Tools: Map<string, Tool> }).__phase4Tools.get(name);
    if (!tool) throw new Error(`Capability unavailable: ${name}`);
    return tool.execute(input);
  }, { name, input });
}
async function names(page: Page) { return page.evaluate(() => [...(window as unknown as { __phase4Tools: Map<string, Tool> }).__phase4Tools.keys()]); }
function handleOnly(url: string) {
  const parsed = new URL(url); expect(parsed.protocol).toBe("https:"); expect(parsed.hash).toBe("");
  expect([...parsed.searchParams.keys()]).toEqual(["mission"]);
  expect(parsed.searchParams.get("mission")).toMatch(/^m_[0-9a-f]{32}$/u);
  return parsed.searchParams.get("mission")!;
}
async function allComplete(page: Page) {
  for (const id of ["civic-status", "partner-status", "nextstep-status"]) await expect(page.locator(`#${id}`)).toHaveText("Complete");

}

test.describe("Phase 4 final mission and receipt", () => {
  test.skip(!process.env.MISSION_URL, "MISSION_URL is required");
  test.setTimeout(180_000); // Adds receipt, responsive and completion durability checks; per-action budgets remain unchanged.
  for (const run of [1, 2, 3]) test(`golden path ${run}`, async ({ page, context }) => {
    const fingerprints = readFingerprints();
    const applicationErrors: string[] = [], platformMessages: string[] = [];
    const responseChecks: Promise<void>[] = [];
    const htmlOrigins = new Set<string>(), scriptOrigins = new Set<string>();
    function check(value: string, label: string) { assertSecretFree(value, label, fingerprints); }
    function monitor(monitoredPage: Page) {
      monitoredPage.on("pageerror", () => applicationErrors.push("Unexpected application page error"));
      monitoredPage.on("request", request => {
        try { check(request.url(), "network URL/query"); check(request.postData() ?? "", "request body"); check(JSON.stringify(request.headers()), "browser request headers"); }
        catch { applicationErrors.push("Secret exposure in browser request"); }
      });
      monitoredPage.on("console", message => {
        const text = message.text();
        try { check(text, "browser console"); } catch { applicationErrors.push("Secret exposure in console"); return; }
        if (!["error", "warning"].includes(message.type())) return;
        const known = text === "Error with Permissions-Policy header: Origin trial controlled feature not enabled: 'tools'."
          || text.startsWith("Executing inline script violates the following Content Security Policy directive 'script-src 'self''.");
        (known ? platformMessages : applicationErrors).push(text);
      });
      // Read bodies only after transfer completes. A response event can precede
      // a navigation-aborted transfer whose body promise stays pending in CDP.
      monitoredPage.on("requestfinished", request => {
        responseChecks.push((async () => {
          const response = await request.response();
          if (!response) return;
          const type = response.headers()["content-type"] ?? "";
          if (!/text|javascript|json/u.test(type)) return;
          const text = await response.text();
          check(text, "deployed HTML/JavaScript/API response"); check(JSON.stringify(response.headers()), "browser response headers");
          if (type.includes("text/html")) htmlOrigins.add(new URL(response.url()).origin);
          if (type.includes("javascript")) scriptOrigins.add(new URL(response.url()).origin);
        })().catch(error => {
          if (String(error).includes("SECRET_LEAK_DETECTED")) applicationErrors.push("Secret exposure in response");
          // Navigation may cancel response-body retrieval; functional assertions
          // and per-origin HTML/JS coverage below must still succeed.
        }));
      });
    }
    monitor(page); await harness(page);
    await page.goto(process.env.MISSION_URL!);
    await page.getByRole("button", { name: "Reset demo", exact: true }).click();
    await page.getByRole("button", { name: "Start mission", exact: true }).click();
    await page.getByRole("button", { name: "Approve Passport", exact: true }).click();
    await expect(page.locator("#passport-status")).toHaveText("Approved");
    const id = handleOnly(page.url());
    const incomplete = await page.request.post(`${new URL(page.url()).origin}/api/action`, { data: { missionId: id, action: "complete_mission" } });
    expect(incomplete.status()).toBe(409); expect((await incomplete.json()).error).toBe("MISSION_INCOMPLETE");
    await expect(page.locator("#nextstep-scope-list")).toHaveText("register_profile, match_roles");
    await expect(page.locator("#mission-completion")).toBeHidden();

    await page.getByRole("button", { name: /Continue to CivicAid/u }).click();
    await expect(page.locator("#capability-count")).toHaveText("2");
    const civicUrl = page.url(); expect(handleOnly(civicUrl)).toBe(id);
    expect(await names(page)).toEqual(["check_eligibility", "prepare_support_claim"]);
    const checking = invoke(page, "check_eligibility");
    await expect(page.locator("#notice")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator("#notice")).toContainText("Checking eligibility");
    expect((await checking).eligible).toBe(true);
    expect(await invoke(page, "prepare_support_claim")).toMatchObject({ status: "prepared", fieldsPrepared: 5, fieldsNeedingHumanInput: 1 });
    await expect(page.locator("#identifier-count")).toHaveText("0");
    await page.getByRole("button", { name: /Return to Mission/u }).click();
    await expect(page.locator("#civic-status")).toHaveText("Complete");

    await page.getByRole("button", { name: /Continue to BrightEnergy/u }).click();
    await expect(page.locator("#capability-count")).toHaveText("2");
    const brightUrl = page.url(); expect(handleOnly(brightUrl)).toBe(id);
    expect(await names(page)).toEqual(["get_account_summary", "apply_hardship"]);
    await invoke(page, "get_account_summary"); await invoke(page, "apply_hardship", { program: "temporary_relief" });
    const denial = await page.request.post(`${new URL(brightUrl).origin}/api/action`, { data: { missionId: id, action: "change_plan", input: { plan: "saver_flex" } } });
    expect(denial.status()).toBe(403); expect(await denial.json()).toEqual({ error: "MISSION_SCOPE_DENIED", capability: "brightenergy.change_plan" });
    await expect(page.locator("#request-change")).toBeDisabled();
    await page.getByRole("button", { name: /Grant/u }).click();
    await expect(page.locator("#capability-count")).toHaveText("3");
    expect(await names(page)).toEqual(["get_account_summary", "apply_hardship", "change_plan"]);
    const pendingStart = Date.now(); const pending = await invoke(page, "change_plan", { plan: "saver_flex" });
    const pendingMs = Date.now() - pendingStart; expect(pendingMs).toBeLessThan(10_000);
    test.info().annotations.push({ type: "awaiting_approval_ms", description: String(pendingMs) });
    expect(pending.status).toBe("awaiting_approval");
    await expect(page.locator("#current-plan")).toHaveText("Standard Flex");
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.locator("#approval-status")).toContainText("Approved");
    expect((await invoke(page, "change_plan", { approvalId: pending.approvalId })).status).toBe("completed");
    expect((await invoke(page, "change_plan", { approvalId: pending.approvalId })).idempotent).toBe(true);
    await page.getByRole("button", { name: /Return to Mission/u }).click();
    await expect(page.locator("#partner-status")).toHaveText("Complete");

    await page.getByRole("button", { name: /Continue to NextStep/u }).click();
    await expect(page.locator("#capability-count")).toHaveText("2");
    const nextUrl = page.url(); expect(handleOnly(nextUrl)).toBe(id);
    expect(new Set([new URL(civicUrl).origin, new URL(brightUrl).origin, new URL(nextUrl).origin, new URL(process.env.MISSION_URL!).origin]).size).toBe(4);
    expect(await names(page)).toEqual(["register_profile", "match_roles"]);
    expect(await page.evaluate(() => (window as unknown as { __phase4Tools: Map<string, Tool> }).__phase4Tools.get("match_roles")?.annotations?.readOnlyHint)).toBe(true);
    expect((await context.cookies(nextUrl)).find(cookie => cookie.name === "__Host-ruvel-demo")).toMatchObject({ secure: true, httpOnly: true });
    const registerStart = Date.now(); expect(await invoke(page, "register_profile")).toMatchObject({ status: "registered", profileStatus: "active" });
    test.info().annotations.push({ type: "register_profile_ms", description: String(Date.now() - registerStart) });
    const matchStart = Date.now(); const matches = await invoke(page, "match_roles", { limit: 3 });
    test.info().annotations.push({ type: "match_roles_ms", description: String(Date.now() - matchStart) });
    expect(matches.matches).toHaveLength(3);
    await expect(page.locator(".role-card")).toHaveCount(3); await expect(page.getByText("DEMO OPPORTUNITY", { exact: true })).toHaveCount(3);
    await expect(page.locator("#profile-status")).toHaveText("Active");
    expect(await invoke(page, "match_roles", { limit: 3 })).toEqual(matches);
    await page.getByRole("button", { name: /Return to Mission/u }).click();
    await allComplete(page); const hubUrl = page.url(); expect(handleOnly(hubUrl)).toBe(id);
    await expect(page.locator("#mission-completion")).toBeVisible();
    await page.getByRole("button", { name: "Complete Mission", exact: true }).click();
    await expect(page.locator("#mission-finished")).toBeVisible();
    await page.getByRole("button", { name: "View Mission Receipt", exact: true }).click();
    await expect(page.locator("#receipt-view")).toBeVisible();
    await expect(page.locator("#receipt-organisations")).toHaveText("3");
    await expect(page.locator("#receipt-completed")).toHaveText("3 / 3");
    await expect(page.locator("#receipt-actions")).toHaveText("7");
    await expect(page.locator("#receipt-decisions")).toHaveText("3");
    await expect(page.locator("#receipt-identifiers")).toHaveText("0");
    await expect(page.locator("#receipt-masked-id")).toHaveText(`Mission m_••••${id.slice(-4).toUpperCase()}`);
    expect(await page.locator("#mission-receipt").innerHTML()).not.toContain(id);
    expect(await page.locator("#mission-receipt").innerHTML()).not.toContain(String(pending.approvalId));
    await expect(page.locator(".authority-history")).toContainText("Granted by human");
    await expect(page.locator(".authority-history")).toContainText("Human approved");
    await expect(page.locator(".authority-history")).toContainText("not recorded");
    await expect(page.locator(".receipt-organisation")).toHaveCount(3);
    await expect(page.locator(".technical-audit")).not.toHaveAttribute("open");
    if (run === 1) {
      for (const [label, width, height] of [["desktop", 1440, 900], ["laptop", 1280, 800], ["narrow", 390, 844]] as const) {
        await page.setViewportSize({ width, height });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.screenshot({ path: `artifacts/phase4-receipt-${label}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 1280, height: 800 });
    }
    await page.locator(".technical-audit summary").click();
    await expect(page.locator(".technical-audit")).toHaveAttribute("open");
    expect(await page.locator("#mission-receipt").innerHTML()).not.toContain(id);
    const canonicalResponse = await page.request.post(`${new URL(hubUrl).origin}/api/action`, { data: { missionId: id, action: "read_state" } });
    const canonicalText = await canonicalResponse.text(); check(canonicalText, "canonical audit");
    const canonical = JSON.parse(canonicalText) as { state: { completion: { completedAt: number }; audit: { at: number; kind: string; id: string; origin: string; capability: string; redactedArgs: unknown; identifierArgumentCount: number }[] }; receipt: { completedAt: number; summary: { recordedToolActions: number; authorityDecisions: number }; privacy: { identityBearingArguments: number }; authority: { at: number | null; label: string }[] } };
    expect(canonical.state.audit).toHaveLength(20);
    expect(new Set(canonical.state.audit.map(event => event.id)).size).toBe(20);
    expect(new Set(canonical.state.audit.map(event => event.origin))).toEqual(new Set([new URL(civicUrl).origin, new URL(brightUrl).origin, new URL(nextUrl).origin, new URL(hubUrl).origin]));
    const nextEvents = canonical.state.audit.filter(event => event.origin === new URL(nextUrl).origin);
    expect(nextEvents).toHaveLength(4); expect(nextEvents.every(event => event.identifierArgumentCount === 0)).toBe(true);
    expect(nextEvents.find(event => event.capability === "register_profile")?.redactedArgs).toEqual({});
    expect(nextEvents.find(event => event.capability === "match_roles")?.redactedArgs).toEqual({ limit: 3 });
    expect(canonical.receipt.completedAt).toBe(canonical.state.completion.completedAt);
    expect(canonical.receipt.summary.recordedToolActions).toBe(canonical.state.audit.filter(event => event.kind === "tool_invoked").length);
    expect(canonical.receipt.summary.authorityDecisions).toBe(canonical.state.audit.filter(event => ["passport_approved", "capability_granted", "human_approved"].includes(event.kind)).length);
    expect(canonical.receipt.privacy.identityBearingArguments).toBe(canonical.state.audit.filter(event => event.kind === "tool_invoked").reduce((sum, event) => sum + event.identifierArgumentCount, 0));
    expect(canonical.receipt.authority.find(item => item.label === "Human approved")?.at).toBe(canonical.state.audit.find(event => event.kind === "human_approved")?.at);
    const duplicateCompletion = await page.request.post(`${new URL(hubUrl).origin}/api/action`, { data: { missionId: id, action: "complete_mission" } });
    expect((await duplicateCompletion.json()).result.idempotent).toBe(true);
    const freshContext = await context.browser()!.newContext(); const fresh = await freshContext.newPage(); monitor(fresh);
    await fresh.goto(hubUrl); await allComplete(fresh); await expect(fresh.locator("#mission-finished")).toBeVisible(); await fresh.getByRole("button", { name: "View Mission Receipt", exact: true }).click(); await expect(fresh.locator("#receipt-actions")).toHaveText("7"); await expect(fresh.locator("#receipt-masked-id")).toHaveText(`Mission m_••••${id.slice(-4).toUpperCase()}`); await freshContext.close();
    await page.goto(civicUrl); await expect(page.locator("#claim-status")).toHaveText("Prepared");
    await page.goto(brightUrl); await expect(page.locator("#current-plan")).toHaveText("Saver Flex");
    await page.goto(nextUrl); await expect(page.locator("#profile-status")).toHaveText("Active"); await expect(page.locator(".role-card")).toHaveCount(3);
    await page.getByRole("button", { name: /Return to Mission/u }).click();
    await page.getByRole("button", { name: "Reset demo", exact: true }).click();
    await expect(page.locator("#passport-status")).toHaveText("Awaiting approval");
    await expect(page.locator("#mission-receipt")).toBeEmpty(); await expect(page.locator("#mission-finished")).toBeHidden();
    for (const selector of ["#civic-outcomes", "#outcomes", "#nextstep-outcomes"]) await expect(page.locator(selector)).toBeEmpty();
    await expect(page.locator("#mission-completion")).toBeHidden(); expect(handleOnly(page.url())).toBe(id);
    await page.getByRole("button", { name: "Approve Passport", exact: true }).click();
    await page.getByRole("button", { name: /Continue to NextStep/u }).click();
    await expect(page.locator("#capability-count")).toHaveText("2"); await expect(page.locator("#profile-status")).toHaveText("Not registered"); await expect(page.locator(".role-card")).toHaveCount(0);
    await page.goto(brightUrl); await expect(page.locator("#capability-count")).toHaveText("2"); expect(await names(page)).not.toContain("change_plan");
    await expect(page.locator("#current-plan")).toHaveText("Standard Flex"); await expect(page.locator("#hardship-status")).toHaveText("None"); await expect(page.locator("#approval-card")).toBeHidden();
    await page.goto(civicUrl); await expect(page.locator("#capability-count")).toHaveText("2"); await expect(page.locator("#eligibility")).toHaveText("Unchecked"); await expect(page.locator("#claim-status")).toHaveText("None");
    // End polling and release body reads tied to documents discarded during
    // navigation before awaiting the complete evidence collector.
    await page.close();
    await Promise.all(responseChecks);
    expect(htmlOrigins.size).toBe(4); expect(scriptOrigins.size).toBe(4); expect(applicationErrors).toEqual([]);
    const evidence = JSON.stringify({ platformMessages, htmlOrigins: [...htmlOrigins], scriptOrigins: [...scriptOrigins], secretLeakCheck: "PASS", auditEventCountBeforeReset: 20 }, null, 2);
    check(evidence, "E2E attachment"); await test.info().attach("phase4-console-and-leak-checks", { body: evidence, contentType: "application/json" });
  });
});
