import type { DurableAction, DurableResponse } from "./types";

// Transport only: the canonical state and signing material never live in browser storage.
export class MissionClient {
  missionId = new URLSearchParams(location.search).get("mission") ?? "";
  sites: DurableResponse["sites"] | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly changed: (response: DurableResponse) => void | Promise<void>) {}
  async initialize(partner = false) {
    // Phase 1 snapshots cannot be migrated as trusted canonical state.
    sessionStorage.removeItem("ruvel.phase1.mission");
    sessionStorage.removeItem("ruvel.phase1.brightenergy");
    history.replaceState(null, "", `${location.pathname}${this.missionId ? `?mission=${encodeURIComponent(this.missionId)}` : ""}`);
    const response = await fetch("/api/config");
    const config = await response.json() as { sites: DurableResponse["sites"]; error?: string };
    if (!response.ok) throw new Error(config.error ?? "Unable to read site configuration");
    this.sites = config.sites;
    if (partner) {
      const session = await fetch("/api/session");
      if (!session.ok) throw new Error("Unable to open the fictional signed-in session");
    }
    if (this.missionId) await this.action("read_state");
    else if (partner) throw new Error("Open this partner from an approved Ruvel Mission.");
  }
  action(action: DurableAction, input: Record<string, unknown> = {}) { return this.send("/api/action", { action, input }); }
  reset(newMission = false) { return this.send("/api/reset", {}, newMission); }
  private send(path: string, body: Record<string, unknown>, newMission = false) {
    const task = this.queue.then(async () => {
      const response = await fetch(path, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, ...(!newMission && this.missionId ? { missionId: this.missionId } : {}) }),
      });
      const payload = await response.json() as DurableResponse & { error?: string; capability?: string };
      if (!response.ok) throw new Error(`${payload.error ?? "Request failed"}${payload.capability ? `: ${payload.capability}` : ""}`);
      this.missionId = payload.missionId;
      this.sites = payload.sites;
      history.replaceState(null, "", `${location.pathname}?mission=${encodeURIComponent(this.missionId)}`);
      await this.changed(payload);
      return payload.result;
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
  navigate(site: keyof DurableResponse["sites"]) {
    if (!this.sites || (!this.missionId && site !== "mission")) throw new Error("Mission is not ready");
    const url = new URL(this.sites[site]);
    if (url.protocol !== "https:") throw new Error("Trusted HTTPS is required");
    if (this.missionId) url.searchParams.set("mission", this.missionId);
    location.assign(url.href);
  }
  observe(onError: (message: string) => void) {
    window.setInterval(() => {
      if (this.missionId && document.visibilityState === "visible") {
        void this.action("read_state").catch((error: unknown) => onError(error instanceof Error ? error.message : "Mission refresh failed"));
      }
    }, 4000);
  }
}
