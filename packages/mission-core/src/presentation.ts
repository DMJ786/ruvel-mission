// Presentation only. Raw server errors and native tool schemas remain unchanged.
export function friendlyMissionError(message: string): string {
  if (message.includes("PASSPORT_EXPIRED")) return "Mission Passport expired. Reset Demo and approve a fresh Passport at Ruvel Mission.";
  if (message.includes("PASSPORT_INVALID")) return "This Mission Passport is stale or invalid. Return to Ruvel Mission and Reset Demo.";
  if (message.includes("PASSPORT_NOT_APPROVED")) return "This Mission needs Passport approval. Return to Mission to approve it.";
  if (message.includes("MISSION_SCOPE_DENIED")) return "BrightEnergy hasn't granted plan changes for this Mission. Use the mission-only grant when you're ready.";
  if (message.includes("MISSION_COMPLETED")) return "This Mission is complete. View its Receipt at Ruvel, or Reset Demo to start again.";
  if (message.includes("MISSION_INCOMPLETE")) return "Complete CivicAid, BrightEnergy and NextStep before completing the Mission.";
  if (message.includes("MISSION_NOT_FOUND")) return "This Mission could not be found. Return to Ruvel Mission and start a fresh demo.";
  if (message.includes("MISSION_CONFLICT_RETRY")) return "The Mission changed in another request. Wait for it to refresh, then try again.";
  if (message.includes("APPROVAL_REQUIRED")) return "Approve the pending plan change on this page before asking the agent to continue.";
  if (message.includes("APPROVAL_EXPIRED")) return "This plan-change approval expired. Return to Mission and Reset Demo.";
  if (message.includes("PROFILE_REQUIRED")) return "Register the employment profile before finding opportunities.";
  if (message.includes("ELIGIBILITY_CHECK_REQUIRED")) return "Check eligibility before preparing the support claim.";
  if (message.includes("not valid JSON") || message.includes("Unexpected token")) return "The Mission service returned an unexpected response. Refresh the page, or use the deployed HTTPS demo.";
  if (message.includes("Failed to fetch") || message.includes("INTERNAL_ERROR")) return "The site couldn't reach your Mission. Please try again; no completion has been assumed.";
  return message.replace(/^Error:\s*/u, "");
}
export const actionWaitLabels: Record<string, string> = {
  get_account_summary: "Reviewing the energy account…", apply_hardship: "Activating hardship assistance…",
  change_plan: "Checking the plan-change request…", grant_change_plan: "Granting authority for this Mission…", approve_action: "Recording your approval…",
  check_eligibility: "Checking eligibility…", prepare_support_claim: "Preparing your claim…",
  register_profile: "Registering your employment profile…", match_roles: "Finding suitable opportunities…",
  approve_passport: "Recording your Passport approval…", complete_mission: "Checking all outcomes and preparing your Receipt…",
};
export async function withActionFeedback<T>(action: string, task: () => Promise<T>, notice: (message: string) => void): Promise<T> {
  const element = document.querySelector<HTMLElement>("#notice");
  element?.setAttribute("aria-busy", "true");
  notice(actionWaitLabels[action] ?? "Updating your Mission…");
  try { const result = await task(); notice("Saved to your Mission."); return result; }
  catch (error) { notice(friendlyMissionError(error instanceof Error ? error.message : "Action failed. Please try again.")); throw error; }
  finally { element?.setAttribute("aria-busy", "false"); }
}
