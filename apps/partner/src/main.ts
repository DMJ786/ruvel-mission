import {
  printable,
  registerOwnedTool,
  requireElement,
  type OwnedRegistration,
} from "@ruvel/spike-core";
import "./styles.css";

function configuredOrigin(parameter: string) {
  const configured = new URLSearchParams(location.search).get(parameter);
  if (!configured) throw new Error(`Missing required ${parameter} HTTPS origin`);
  const parsed = new URL(configured);
  if (parsed.protocol !== "https:") throw new Error(`${parameter} must be an HTTPS origin`);
  return parsed.origin;
}

const hubOrigin = configuredOrigin("hubOrigin");
const modelContext = document.modelContext;
let registration: OwnedRegistration | undefined;
let registered = false;
let invocationCount = 0;

requireElement<HTMLElement>("#origin").textContent = location.origin;
requireElement<HTMLElement>("#secure-context").textContent = String(window.isSecureContext);
requireElement<HTMLElement>("#register-api").textContent = String(
  typeof modelContext?.registerTool === "function",
);
requireElement<HTMLElement>("#exposed-to").textContent = hubOrigin;

function log(event: string, detail?: unknown) {
  const item = document.createElement("li");
  item.textContent = `${new Date().toISOString()} · ${event}${detail === undefined ? "" : ` · ${printable(detail)}`}`;
  requireElement<HTMLOListElement>("#event-log").prepend(item);
}

function renderRegistration() {
  const state = requireElement<HTMLElement>("#registration-state");
  const button = requireElement<HTMLButtonElement>("#toggle-registration");
  state.textContent = registered ? "Registered" : "Unregistered";
  state.dataset.state = registered ? "registered" : "unregistered";
  button.textContent = registered ? "Unregister" : "Register";
}

async function registerPing() {
  if (!modelContext) {
    log("document.modelContext unavailable");
    return;
  }
  if (registration) registration.unregister();
  registration = registerOwnedTool(
    modelContext,
    {
      name: "ping",
      title: "Ping independent partner",
      description: "Return an echo from the independent partner origin with a runtime timestamp.",
      inputSchema: {
        type: "object",
        properties: { message: { type: "string", minLength: 1, maxLength: 120 } },
        required: ["message"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        invocationCount += 1;
        const message = typeof input.message === "string" ? input.message : "";
        const output = {
          origin: "partner",
          received: message,
          timestamp: new Date().toISOString(),
        };
        requireElement<HTMLElement>("#invocation-count").textContent = String(invocationCount);
        requireElement<HTMLElement>("#last-input").textContent = printable(input);
        requireElement<HTMLElement>("#last-output").textContent = printable(output);
        log("ping invoked", { input, output });
        return output;
      },
    },
    { exposedTo: [hubOrigin] },
  );
  try {
    await registration.ready;
    registered = true;
    renderRegistration();
    log("ping registered", { exposedTo: hubOrigin });
  } catch (error) {
    registered = false;
    renderRegistration();
    log("ping registration failed", error);
  }
}

function unregisterPing() {
  registration?.unregister();
  registration = undefined;
  registered = false;
  renderRegistration();
  log("ping unregistered via AbortSignal");
}

requireElement<HTMLButtonElement>("#toggle-registration").addEventListener("click", () => {
  if (registered) unregisterPing();
  else void registerPing();
});
window.addEventListener("beforeunload", unregisterPing);

renderRegistration();
void registerPing();
