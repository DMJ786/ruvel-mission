import { expect, test, type Page } from "@playwright/test";

type CapturedTool = { execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>> };

async function installWebMcpHarness(page: Page) {
  await page.addInitScript(() => {
    const tools = new Map<string, { execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }>();
    Object.defineProperty(window, "__phase1Tools", { value: tools, configurable: false });
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        async registerTool(tool: { name: string; execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }, options?: { signal?: AbortSignal }) {
          tools.set(tool.name, tool);
          options?.signal?.addEventListener("abort", () => tools.delete(tool.name), { once: true });
        },
      },
    });
  });
}

async function toolNames(page: Page) {
  return page.evaluate(() => [...(window as unknown as { __phase1Tools: Map<string, CapturedTool> }).__phase1Tools.keys()]);
}

async function invoke(page: Page, name: string, input: Record<string, unknown> = {}) {
  return page.evaluate(async ({ toolName, toolInput }) => {
    const tools = (window as unknown as { __phase1Tools: Map<string, CapturedTool> }).__phase1Tools;
    const tool = tools.get(toolName);
    if (!tool) throw new Error(`Tool not registered: ${toolName}`);
    return tool.execute(toolInput);
  }, { toolName: name, toolInput: input });
}

const missionOrigin = process.env.MISSION_URL;
const brightOrigin = process.env.BRIGHTENERGY_URL;

test.skip(!missionOrigin || !brightOrigin, "MISSION_URL and BRIGHTENERGY_URL are required");

for (const run of [1, 2, 3]) {
  test(`Phase 1 golden path run ${run}`, async ({ page }) => {
    await installWebMcpHarness(page);
    const missionUrl = new URL(missionOrigin!);
    missionUrl.searchParams.set("brightOrigin", brightOrigin!);
    await page.goto(missionUrl.href);

    await page.getByRole("button", { name: "Reset demo" }).click();
    await page.getByRole("button", { name: "Start mission" }).click();
    await page.getByRole("button", { name: "Approve Passport" }).click();
    await expect(page.locator("#passport-status")).toHaveText("Approved");
    await page.getByRole("button", { name: /Continue to BrightEnergy/u }).click();

    await expect(page.getByRole("heading", { name: "Let’s protect your energy account." })).toBeVisible();
    await expect.poll(() => toolNames(page)).toEqual(["get_account_summary", "apply_hardship"]);
    await expect(page.locator("#capability-count")).toHaveText("2");

    await invoke(page, "get_account_summary");
    await invoke(page, "apply_hardship", { program: "temporary_relief" });
    await expect(page.locator("#hardship-status")).toHaveText("Temporary relief");

    const denial = await page.evaluate(async () => {
      const token = sessionStorage.getItem("ruvel.phase1.brightenergy");
      const response = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "change_plan", input: { plan: "saver_flex" } }),
      });
      return { status: response.status, body: await response.json() as Record<string, unknown> };
    });
    expect(denial).toEqual({ status: 403, body: { error: "MISSION_SCOPE_DENIED", capability: "brightenergy.change_plan" } });

    await page.getByRole("button", { name: /Grant “Change plan”/u }).click();
    await expect.poll(() => toolNames(page)).toEqual(["get_account_summary", "apply_hardship", "change_plan"]);
    await expect(page.locator("#capability-count")).toHaveText("3");

    const requested = await invoke(page, "change_plan", { plan: "saver_flex" });
    expect(requested.status).toBe("awaiting_approval");
    expect(typeof requested.approvalId).toBe("string");
    await expect(page.getByRole("heading", { name: "Switch to Saver Flex?" })).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.locator("#approval-status")).toContainText("Approved");

    const completed = await invoke(page, "change_plan", { approvalId: requested.approvalId });
    expect(completed.status).toBe("completed");
    await expect(page.locator("#current-plan")).toHaveText("Saver Flex");
    await expect(page.locator("#monthly-cost")).toHaveText("$115");

    await page.getByRole("button", { name: /Return to Mission/u }).click();
    await expect(page.locator("#partner-status")).toHaveText("Complete");
    await expect(page.locator("#outcomes")).toContainText("hardship protection activated");
    await expect(page.locator("#outcomes")).toContainText("switched to Saver Flex");
    await expect(page.locator("#outcomes")).toContainText("estimated saving $31/month");

    await page.getByRole("button", { name: "Reset demo" }).click();
    await expect(page.locator("#passport-status")).toHaveText("Awaiting approval");
    await expect(page.locator("#scope-list")).not.toContainText("change_plan");
    await expect(page.locator("#outcomes")).toBeEmpty();
  });
}
