import Dexie, { type Table } from "dexie";

/**
 * Local-first IndexedDB schema mirroring the Supabase tables we need offline.
 * All writes happen here first; the sync engine pushes them to the server.
 */

export interface LocalEvaluation {
  id: string;
  user_id: string;
  type: "chemical" | "noise";
  status: "draft" | "in_progress" | "paused" | "completed";
  title: string | null;
  company: string | null;
  worker: string | null;
  estimated_duration_minutes: number;
  form_data: Record<string, string>;
  worker_signature_url: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /** True when this row has not yet been confirmed by the server. */
  _pending?: 0 | 1;
}

export interface LocalTimeSegment {
  id: string;
  evaluation_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  _pending?: 0 | 1;
}

export interface LocalEquipment {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  serial_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  _pending?: 0 | 1;
}

export interface LocalResponsible {
  id: string;
  user_id: string;
  name: string;
  role: string | null;
  registry: string | null;
  signature_url: string | null;
  created_at: string;
  updated_at: string;
  _pending?: 0 | 1;
}

/** Local-only blob store for signatures awaiting upload. */
export interface LocalSignatureBlob {
  /** Storage path that will be used on Supabase Storage once uploaded. */
  path: string;
  blob: Blob;
  /** "evaluation" -> writes worker_signature_url; "responsible" -> updates responsibles row. */
  kind: "evaluation" | "responsible";
  /** id of the evaluation or responsible this signature belongs to. */
  ownerId: string;
  user_id: string;
  created_at: string;
}

export type OutboxOp = "insert" | "update" | "delete";
export type OutboxTable =
  | "evaluations"
  | "time_segments"
  | "equipments"
  | "responsibles";

export interface OutboxItem {
  /** auto-increment */
  id?: number;
  table: OutboxTable;
  op: OutboxOp;
  /** Row id (for delete + idempotent upsert). */
  rowId: string;
  payload: Record<string, unknown>;
  created_at: string;
  retries: number;
  last_error?: string;
}

export interface MetaRow {
  key: string;
  value: string;
}

class HoFacilDB extends Dexie {
  evaluations!: Table<LocalEvaluation, string>;
  time_segments!: Table<LocalTimeSegment, string>;
  equipments!: Table<LocalEquipment, string>;
  responsibles!: Table<LocalResponsible, string>;
  signature_blobs!: Table<LocalSignatureBlob, string>;
  outbox!: Table<OutboxItem, number>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("ho-facil");
    this.version(1).stores({
      evaluations: "id, user_id, status, updated_at, _pending",
      time_segments: "id, evaluation_id, user_id, started_at, _pending",
      equipments: "id, user_id, name, _pending",
      responsibles: "id, user_id, name, _pending",
      signature_blobs: "path, ownerId, kind",
      outbox: "++id, table, rowId, created_at",
      meta: "key",
    });
  }
}

let _db: HoFacilDB | undefined;

export function getDb(): HoFacilDB {
  if (typeof window === "undefined") {
    throw new Error("Local DB is browser-only");
  }
  if (!_db) _db = new HoFacilDB();
  return _db;
}

export async function getMeta(key: string): Promise<string | undefined> {
  const row = await getDb().meta.get(key);
  return row?.value;
}

export async function setMeta(key: string, value: string) {
  await getDb().meta.put({ key, value });
}

export async function clearLocalData() {
  const db = getDb();
  await Promise.all([
    db.evaluations.clear(),
    db.time_segments.clear(),
    db.equipments.clear(),
    db.responsibles.clear(),
    db.signature_blobs.clear(),
    db.outbox.clear(),
    db.meta.clear(),
  ]);
}
