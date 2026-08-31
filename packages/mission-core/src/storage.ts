import { MissionError } from "./state";

export type StoredMission = { id: string; revision: number; signedState: string; createdAt: string; updatedAt: string };
export interface MissionStore {
  get(id: string): Promise<StoredMission | null>;
  create(record: StoredMission): Promise<void>;
  save(record: StoredMission, expectedRevision: number): Promise<boolean>;
}
type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes?: number } }>;
};
export type MissionDatabase = { prepare(sql: string): Statement };

export function assertMissionHandle(id: unknown): asserts id is string {
  if (typeof id !== "string" || !/^m_[0-9a-f]{32}$/u.test(id)) throw new MissionError("INVALID_MISSION_HANDLE", 400);
}

export const schemaSql = `CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL,
  signed_state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

export class D1MissionStore implements MissionStore {
  constructor(private readonly db: MissionDatabase) {}
  async initialize() { await this.db.prepare(schemaSql).run(); }
  async get(id: string) {
    assertMissionHandle(id);
    return this.db.prepare("SELECT id, revision, signed_state AS signedState, created_at AS createdAt, updated_at AS updatedAt FROM missions WHERE id = ?").bind(id).first<StoredMission>();
  }
  async create(record: StoredMission) {
    await this.db.prepare("INSERT INTO missions (id, revision, signed_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .bind(record.id, record.revision, record.signedState, record.createdAt, record.updatedAt).run();
  }
  async save(record: StoredMission, expectedRevision: number) {
    const result = await this.db.prepare("UPDATE missions SET revision = ?, signed_state = ?, updated_at = ? WHERE id = ? AND revision = ?")
      .bind(record.revision, record.signedState, record.updatedAt, record.id, expectedRevision).run();
    return result.meta.changes === 1;
  }
}
