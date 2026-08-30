export type JsonSchema = Record<string, unknown>;

export type ToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

export type ToolExecutionOptions = { signal: AbortSignal };

export type ToolDefinition = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  execute: (input: Record<string, unknown>, options: ToolExecutionOptions) => unknown | Promise<unknown>;
};

export type RegisteredTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  origin: string;
  window: Window;
};

export type RegisterToolOptions = {
  exposedTo?: string[];
  signal?: AbortSignal;
};

export type ExecuteToolOptions = { signal?: AbortSignal };

export interface WebMcpModelContext extends EventTarget {
  registerTool(tool: ToolDefinition, options?: RegisterToolOptions): Promise<void>;
  getTools?(options?: { fromOrigins?: string[] }): Promise<RegisteredTool[]>;
  executeTool?(
    tool: RegisteredTool,
    input?: Record<string, unknown>,
    options?: ExecuteToolOptions,
  ): Promise<unknown>;
}

declare global {
  interface Document {
    modelContext?: WebMcpModelContext;
  }
}

export type OwnedRegistration = {
  ready: Promise<void>;
  unregister: () => void;
};

export function registerOwnedTool(
  context: WebMcpModelContext,
  tool: ToolDefinition,
  options: Omit<RegisterToolOptions, "signal"> = {},
): OwnedRegistration {
  const controller = new AbortController();
  const ready = context.registerTool(tool, { ...options, signal: controller.signal });
  return { ready, unregister: () => controller.abort() };
}

export async function discoverTools(
  context: WebMcpModelContext,
  fromOrigins: string[] = [],
): Promise<RegisteredTool[]> {
  if (typeof context.getTools !== "function") {
    throw new Error("WEBMCP_GET_TOOLS_UNAVAILABLE");
  }
  return context.getTools({ fromOrigins });
}

export async function executeRegisteredTool(
  context: WebMcpModelContext,
  tool: RegisteredTool,
  input: Record<string, unknown>,
  options?: ExecuteToolOptions,
): Promise<unknown> {
  if (typeof context.executeTool !== "function") {
    throw new Error("WEBMCP_EXECUTE_TOOL_UNAVAILABLE");
  }
  return context.executeTool(tool, input, options);
}

export function printable(value: unknown): string {
  if (value instanceof Error) {
    return JSON.stringify({ name: value.name, message: value.message }, null, 2);
  }
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

