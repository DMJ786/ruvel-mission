import { describe, expect, it, vi } from "vitest";
import {
  discoverTools,
  executeRegisteredTool,
  printable,
  registerOwnedTool,
  type RegisteredTool,
  type ToolDefinition,
  type WebMcpModelContext,
} from "../src/index";

function createContext() {
  const tools = new Map<string, ToolDefinition>();
  const context = new EventTarget() as WebMcpModelContext;
  context.registerTool = vi.fn(async (tool, options) => {
    tools.set(tool.name, tool);
    options?.signal?.addEventListener("abort", () => tools.delete(tool.name), { once: true });
  });
  context.getTools = vi.fn(async () =>
    [...tools.values()].map((tool) => ({
      ...tool,
      origin: "https://partner.localhost:4174",
      window: {} as Window,
    })),
  );
  context.executeTool = vi.fn(async (tool, input) => {
    const definition = tools.get(tool.name);
    if (!definition) throw new Error("missing tool");
    return definition.execute(input ?? {}, { signal: new AbortController().signal });
  });
  return { context, tools };
}

describe("WebMCP spike helpers", () => {
  it("owns registration lifecycle with AbortSignal", async () => {
    const { context, tools } = createContext();
    const registration = registerOwnedTool(context, {
      name: "ping",
      description: "Ping",
      execute: () => ({ ok: true }),
    });
    await registration.ready;
    expect(tools.has("ping")).toBe(true);
    registration.unregister();
    expect(tools.has("ping")).toBe(false);
  });

  it("discovers and executes a registered cross-origin tool descriptor", async () => {
    const { context } = createContext();
    const registration = registerOwnedTool(context, {
      name: "ping",
      description: "Ping",
      execute: ({ message }) => ({ received: message }),
    });
    await registration.ready;
    const [tool] = await discoverTools(context, ["https://partner.localhost:4174"]);
    expect(tool?.origin).toBe("https://partner.localhost:4174");
    await expect(
      executeRegisteredTool(context, tool as RegisteredTool, { message: "hello" }),
    ).resolves.toEqual({ received: "hello" });
  });

  it("fails explicitly when consumer APIs are unavailable", async () => {
    const context = new EventTarget() as WebMcpModelContext;
    context.registerTool = vi.fn(async () => undefined);
    await expect(discoverTools(context)).rejects.toThrow("WEBMCP_GET_TOOLS_UNAVAILABLE");
    await expect(
      executeRegisteredTool(context, {} as RegisteredTool, {}),
    ).rejects.toThrow("WEBMCP_EXECUTE_TOOL_UNAVAILABLE");
  });

  it("prints structured and Error values without losing evidence", () => {
    expect(printable('{"ok":true}')).toContain('"ok": true');
    expect(printable(new TypeError("bad input"))).toContain("bad input");
  });
});

