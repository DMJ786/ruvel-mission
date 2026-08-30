import {
  discoverTools,
  executeRegisteredTool,
  printable,
  registerOwnedTool,
  requireElement,
  type OwnedRegistration,
  type RegisteredTool,
  type WebMcpModelContext,
} from "@ruvel/spike-core";
import "./styles.css";

function configuredOrigin(parameter: string) {
  const configured = new URLSearchParams(location.search).get(parameter);
  if (!configured) throw new Error(`Missing required ${parameter} HTTPS origin`);
  const parsed = new URL(configured);
  if (parsed.protocol !== "https:") throw new Error(`${parameter} must be an HTTPS origin`);
  return parsed.origin;
}

const partnerOrigin = configuredOrigin("partnerOrigin");
const modelContext = document.modelContext;
const registrations: OwnedRegistration[] = [];
let discoveredTools: RegisteredTool[] = [];
let toolchangeCount = 0;
let readCount = 0;
let writeCount = 0;
let pendingApproval:
  | {
      startedAt: number;
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
      cleanup: () => void;
    }
  | undefined;

const originElement = requireElement<HTMLElement>("#origin");
const partnerToolsElement = requireElement<HTMLElement>("#partner-tools");
const crossOriginResultElement = requireElement<HTMLElement>("#cross-origin-result");
const probeResultElement = requireElement<HTMLElement>("#probe-result");
const approvalStateElement = requireElement<HTMLElement>("#approval-state");
const approvalElapsedElement = requireElement<HTMLElement>("#approval-elapsed");
const approveButton = requireElement<HTMLButtonElement>("#approve-slow");
const rejectButton = requireElement<HTMLButtonElement>("#reject-slow");

originElement.textContent = location.origin;
requireElement<HTMLElement>("#partner-origin").textContent = partnerOrigin;
requireElement<HTMLElement>("#secure-context").textContent = String(window.isSecureContext);
requireElement<HTMLElement>("#register-api").textContent = String(
  typeof modelContext?.registerTool === "function",
);
requireElement<HTMLElement>("#get-tools-api").textContent = String(
  typeof modelContext?.getTools === "function",
);
requireElement<HTMLElement>("#execute-tool-api").textContent = String(
  typeof modelContext?.executeTool === "function",
);

function log(event: string, detail?: unknown) {
  const item = document.createElement("li");
  const timestamp = document.createElement("time");
  timestamp.textContent = new Date().toISOString();
  const message = document.createElement("span");
  message.textContent = detail === undefined ? event : `${event} · ${printable(detail)}`;
  item.append(timestamp, message);
  requireElement<HTMLOListElement>("#event-log").prepend(item);
}

function updateProbeState() {
  requireElement<HTMLElement>("#read-count").textContent = `${readCount} invocation${readCount === 1 ? "" : "s"}`;
  requireElement<HTMLElement>("#write-count").textContent = `${writeCount} write${writeCount === 1 ? "" : "s"}`;
  approveButton.disabled = pendingApproval === undefined;
  rejectButton.disabled = pendingApproval === undefined;
  if (!pendingApproval) approvalElapsedElement.textContent = "0s";
}

async function refreshPartnerTools(reason: string) {
  if (!modelContext) {
    partnerToolsElement.textContent = "document.modelContext is unavailable.";
    return;
  }
  try {
    discoveredTools = await discoverTools(modelContext, [partnerOrigin]);
    requireElement<HTMLElement>("#discovered-count").textContent = String(discoveredTools.length);
    partnerToolsElement.textContent = printable(
      discoveredTools.map(({ name, origin, title, annotations }) => ({ name, origin, title, annotations })),
    );
    log(`Partner discovery succeeded (${reason})`, { count: discoveredTools.length });
  } catch (error) {
    discoveredTools = [];
    requireElement<HTMLElement>("#discovered-count").textContent = "0";
    partnerToolsElement.textContent = printable(error);
    log(`Partner discovery failed (${reason})`, error);
  }
}

async function executePartnerPing(source: "button" | "webmcp", message = "hello") {
  if (!modelContext) throw new Error("WEBMCP_MODEL_CONTEXT_UNAVAILABLE");
  await refreshPartnerTools(`before ${source} execution`);
  const ping = discoveredTools.find(
    (tool) => tool.name === "ping" && tool.origin === partnerOrigin,
  );
  if (!ping) throw new Error("PARTNER_PING_NOT_DISCOVERED");
  const input = { message };
  const output = await executeRegisteredTool(modelContext, ping, input);
  const evidence = { input, output, source, completedAt: new Date().toISOString() };
  crossOriginResultElement.textContent = printable(evidence);
  log("Partner ping completed", evidence);
  return evidence;
}

function finishApproval(approved: boolean) {
  const approval = pendingApproval;
  if (!approval) return;
  const elapsedMs = Date.now() - approval.startedAt;
  pendingApproval = undefined;
  approval.cleanup();
  approvalStateElement.textContent = approved ? "Approved" : "Rejected";
  approvalElapsedElement.textContent = `${Math.floor(elapsedMs / 1000)}s`;
  updateProbeState();
  if (approved) {
    const result = { status: "approved", elapsedMs, approvedAt: new Date().toISOString() };
    probeResultElement.textContent = printable(result);
    approval.resolve(result);
    log("slow_tool approved", result);
  } else {
    const error = new Error(`SLOW_TOOL_REJECTED_AFTER_${elapsedMs}MS`);
    probeResultElement.textContent = printable(error);
    approval.reject(error);
    log("slow_tool rejected", { elapsedMs });
  }
}

function executeSlowTool(options?: { signal?: AbortSignal }) {
  if (pendingApproval) throw new Error("SLOW_TOOL_ALREADY_PENDING");
  const signal = options?.signal;
  approvalStateElement.textContent = "Awaiting human approval";
  log("slow_tool awaiting approval");
  if (!signal) log("slow_tool invoked without AbortSignal");
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      if (!pendingApproval) return;
      const elapsedMs = Date.now() - pendingApproval.startedAt;
      pendingApproval = undefined;
      approvalStateElement.textContent = "Aborted by agent";
      approvalElapsedElement.textContent = `${Math.floor(elapsedMs / 1000)}s`;
      updateProbeState();
      const error = new DOMException("Agent aborted slow_tool", "AbortError");
      probeResultElement.textContent = printable(error);
      log("slow_tool AbortSignal triggered", { elapsedMs });
      reject(error);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    pendingApproval = {
      startedAt: Date.now(),
      resolve,
      reject,
      cleanup: () => signal?.removeEventListener("abort", onAbort),
    };
    updateProbeState();
  });
}

async function registerTopLevelTools(context: WebMcpModelContext) {
  const tools = [
    {
      name: "ping_partner",
      title: "Ping partner origin",
      description: "Read a hello response from the embedded partner through native cross-origin WebMCP discovery and execution.",
      inputSchema: {
        type: "object",
        properties: { message: { type: "string", minLength: 1, maxLength: 120 } },
        required: ["message"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input: Record<string, unknown>) =>
        executePartnerPing("webmcp", typeof input.message === "string" ? input.message : "hello"),
    },
    {
      name: "read_probe",
      title: "Read runtime probe",
      description: "Read the current WebMCP spike counters without changing state.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: () => {
        readCount += 1;
        updateProbeState();
        const result = { readCount, writeCount, pendingApproval: pendingApproval !== undefined };
        probeResultElement.textContent = printable(result);
        log("read_probe invoked", result);
        return result;
      },
    },
    {
      name: "write_probe",
      title: "Increment write counter",
      description: "Perform an ordinary reversible write by incrementing a local-only counter once.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute: () => {
        writeCount += 1;
        updateProbeState();
        const result = { status: "written", writeCount };
        probeResultElement.textContent = printable(result);
        log("write_probe invoked", result);
        return result;
      },
    },
    {
      name: "slow_tool",
      title: "Approve consequential slow tool",
      description: "Request an explicit human decision and keep this consequential write pending until the person approves or rejects it.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute: (_input: Record<string, unknown>, options?: { signal?: AbortSignal }) =>
        executeSlowTool(options),
    },
  ];

  for (const tool of tools) {
    const registration = registerOwnedTool(context, tool);
    registrations.push(registration);
    try {
      await registration.ready;
      log("Top-level tool registered", { name: tool.name });
    } catch (error) {
      log("Top-level tool registration failed", { name: tool.name, error: printable(error) });
    }
  }
  requireElement<HTMLElement>("#top-level-count").textContent = `${registrations.length} registered`;
}

requireElement<HTMLButtonElement>("#discover-partner").addEventListener("click", () => {
  void refreshPartnerTools("manual button");
});
requireElement<HTMLButtonElement>("#execute-ping").addEventListener("click", () => {
  void executePartnerPing("button").catch((error: unknown) => {
    crossOriginResultElement.textContent = printable(error);
    log("Partner ping failed", error);
  });
});
approveButton.addEventListener("click", () => finishApproval(true));
rejectButton.addEventListener("click", () => finishApproval(false));

const frame = requireElement<HTMLIFrameElement>("#partner-frame");
frame.src = `${partnerOrigin}/?hubOrigin=${encodeURIComponent(location.origin)}`;
frame.addEventListener("load", () => {
  requireElement<HTMLElement>("#iframe-state").textContent = "Loaded";
  log("Partner iframe loaded");
  window.setTimeout(() => void refreshPartnerTools("iframe load"), 250);
});

if (modelContext) {
  const eventTarget = modelContext as WebMcpModelContext & {
    addEventListener?: (type: string, listener: EventListener) => void;
  };
  if (typeof eventTarget.addEventListener === "function") {
    eventTarget.addEventListener("toolchange", () => {
      toolchangeCount += 1;
      requireElement<HTMLElement>("#toolchange-count").textContent = String(toolchangeCount);
      log("Hub received native toolchange", { count: toolchangeCount });
      void refreshPartnerTools("native toolchange");
    });
  } else {
    log("modelContext.addEventListener unavailable; lifecycle will be checked explicitly");
  }
  void registerTopLevelTools(modelContext);
} else {
  log("document.modelContext unavailable");
}

window.addEventListener("beforeunload", () => {
  for (const registration of registrations) registration.unregister();
});
window.setInterval(() => {
  if (pendingApproval) {
    approvalElapsedElement.textContent = `${Math.floor((Date.now() - pendingApproval.startedAt) / 1000)}s`;
  }
}, 250);
updateProbeState();
