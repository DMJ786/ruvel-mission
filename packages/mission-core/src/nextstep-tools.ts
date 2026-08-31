import type { ToolDefinition } from "../../spike-core/src/index";
import type { NextStepCapability } from "./types";

export function nextStepToolDefinition(name: NextStepCapability, execute: ToolDefinition["execute"]): ToolDefinition {
  return name === "register_profile" ? {
    name, title: "Register NextStep employment profile",
    description: "Register the fictional employment-support profile from NextStep's own signed-in session and mission-authorised employment context. No identity arguments or additional human approval are needed. No job application is submitted.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false }, execute,
  } : {
    name, title: "Find suitable NextStep roles",
    description: "Read fictional demo opportunities matching the signed-in NextStep profile. Register the profile first. This search changes no employment record and submits no applications; its results are saved to the mission.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 3, default: 3 } }, additionalProperties: false },
    annotations: { readOnlyHint: true }, execute,
  };
}
