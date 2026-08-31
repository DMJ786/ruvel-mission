import { expect, test, type Page } from "@playwright/test";

type Tool = { execute(input: Record<string, unknown>): Promise<Record<string, unknown>> };
async function harness(page: Page) {
  await page.addInitScript(() => {
    const tools = new Map<string, Tool>();
    Object.defineProperty(window, "__phase2Tools", { value: tools });
    Object.defineProperty(document, "modelContext", { value: {
      async registerTool(tool: Tool & { name: string }, options?: { signal?: AbortSignal }) {
        tools.set(tool.name, tool);
        options?.signal?.addEventListener("abort", () => tools.delete(tool.name), { once: true });
      },
    } });
  });
}
async function invoke(page: Page, name: string, input: Record<string, unknown> = {}) {
  return page.evaluate(async ({ name, input }) => {
    const tool = (window as unknown as { __phase2Tools: Map<string, Tool> }).__phase2Tools.get(name);
    if (!tool) throw new Error(`Capability unavailable: ${name}`);
    return tool.execute(input);
  }, { name, input });
}
async function names(page: Page) {
  return page.evaluate(() => [...(window as unknown as { __phase2Tools: Map<string, Tool> }).__phase2Tools.keys()]);
}
function handleOnly(url: string) {
  const parsed = new URL(url);
  expect(parsed.hash).toBe("");
  expect([...parsed.searchParams.keys()]).toEqual(["mission"]);
  expect(parsed.searchParams.get("mission")).toMatch(/^m_[0-9a-f]{32}$/u);
  return parsed.searchParams.get("mission")!;
}
test.describe("Phase 2 two-partner mission", () => {
  test.skip(!process.env.MISSION_URL, "MISSION_URL is required");
  for (const run of [1, 2, 3]) test(`golden path ${run}`, async ({ page, context }) => {
    await harness(page);
    await page.goto(process.env.MISSION_URL!);
    await page.getByRole("button", { name: "Reset demo" }).click();
    await page.getByRole("button", { name: "Start mission" }).click();
    await page.getByRole("button", { name: "Approve Passport" }).click();
    await expect(page.locator("#passport-status")).toHaveText("Approved");
    const missionId = handleOnly(page.url());
    await page.getByRole("button", { name: /Continue to CivicAid/u }).click();
    await expect(page.locator("#capability-count")).toHaveText("2");
    expect(handleOnly(page.url())).toBe(missionId);
    expect(await names(page)).toEqual(["check_eligibility", "prepare_support_claim"]);
    const eligibility = await invoke(page, "check_eligibility");
    expect(eligibility.eligible).toBe(true);
    const claim = await invoke(page, "prepare_support_claim");
    expect(claim).toMatchObject({ status: "prepared", fieldsPrepared: 5, fieldsNeedingHumanInput: 1 });
    await expect(page.locator("#claim-fields > div")).toHaveCount(6);
    await expect(page.locator("#argument-log")).toContainText("check_eligibility({})");
    await expect(page.locator("#argument-log")).toContainText("prepare_support_claim({})");
    await expect(page.locator("#identifier-count")).toHaveText("0");
    const civicUrl = page.url();
    const cookie = (await context.cookies(civicUrl)).find(item => item.name === "__Host-ruvel-demo");
    expect(cookie).toMatchObject({ httpOnly: true, secure: true });
    await page.getByRole("button", { name: /Return to Mission/u }).click();
    await expect(page.locator("#civic-status")).toHaveText("Complete");
    await page.getByRole("button", { name: /Continue to BrightEnergy/u }).click();
    await expect(page.locator("#capability-count")).toHaveText("2");
    expect(handleOnly(page.url())).toBe(missionId);
    expect(await names(page)).not.toContain("change_plan");
    await invoke(page, "get_account_summary");
    await invoke(page, "apply_hardship", { program: "temporary_relief" });
    const denial = await page.request.post(`${new URL(page.url()).origin}/api/action`, { data: { missionId, action: "change_plan", input: { plan: "saver_flex" } } });
    expect(denial.status()).toBe(403);
    expect(await denial.json()).toEqual({ error: "MISSION_SCOPE_DENIED", capability: "brightenergy.change_plan" });
    await expect(page.locator("#request-change")).toBeDisabled();
    await page.getByRole("button", { name: /Grant/u }).click();
    await expect(page.locator("#capability-count")).toHaveText("3");
    expect(await names(page)).toContain("change_plan");
    const pending = await invoke(page, "change_plan", { plan: "saver_flex" });
    expect(pending.status).toBe("awaiting_approval");
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.locator("#approval-status")).toContainText("Approved");
    expect((await invoke(page, "change_plan", { approvalId: pending.approvalId })).status).toBe("completed");
    expect((await invoke(page, "change_plan", { approvalId: pending.approvalId })).idempotent).toBe(true);
    await expect(page.locator("#current-plan")).toHaveText("Saver Flex");
    const brightUrl = page.url();
    await page.getByRole("button", { name: /Return to Mission/u }).click();
    await expect(page.locator("#civic-status")).toHaveText("Complete");
    await expect(page.locator("#partner-status")).toHaveText("Complete");
    const hubUrl = page.url();
    const canonical = await page.request.post(`${new URL(hubUrl).origin}/api/action`, { data: { missionId, action: "read_state" } });
    const snapshot = await canonical.json() as { state: { audit: { origin: string; capability: string; redactedArgs: unknown }[] } };
    expect(snapshot.state.audit.some(event => event.origin === new URL(civicUrl).origin && event.capability === "prepare_support_claim")).toBe(true);
    expect(snapshot.state.audit.some(event => event.origin === new URL(brightUrl).origin && event.capability === "change_plan")).toBe(true);
    // A new context has no previous sessionStorage or app state, only the opaque handle.
    const freshContext = await page.context().browser()!.newContext();
    const freshPage = await freshContext.newPage();
    await freshPage.goto(hubUrl);
    await expect(freshPage.locator("#civic-status")).toHaveText("Complete");
    await expect(freshPage.locator("#partner-status")).toHaveText("Complete");
    await freshContext.close();
    await page.goto(civicUrl);
    await expect(page.locator("#claim-status")).toHaveText("Prepared");
    await page.getByRole("button", { name: /Return to Mission/u }).click();
    await page.getByRole("button", { name: "Reset demo" }).click();
    await expect(page.locator("#passport-status")).toHaveText("Awaiting approval");
    await expect(page.locator("#civic-outcomes")).toBeEmpty();
    await expect(page.locator("#outcomes")).toBeEmpty();
    await page.getByRole("button", { name: "Approve Passport" }).click();
    await page.getByRole("button", { name: /Continue to BrightEnergy/u }).click();
    await expect(page.locator("#capability-count")).toHaveText("2");
    await expect(page.locator("#current-plan")).toHaveText("Standard Flex");
    await expect(page.locator("#hardship-status")).toHaveText("None");
    await expect(page.locator("#approval-card")).toBeHidden();
    await page.goto(civicUrl);
    await expect(page.locator("#capability-count")).toHaveText("2");
    await expect(page.locator("#eligibility")).toHaveText("Unchecked");
    await expect(page.locator("#claim-status")).toHaveText("None");
    await expect(page.locator("#argument-log")).toBeEmpty();
  });
});
