import { supabase } from "@/integrations/supabase/client";
import {
  getDb,
  getMeta,
  setMeta,
  type LocalEquipment,
  type LocalEvaluation,
  type LocalResponsible,
  type LocalTimeSegment,
} from "@/lib/db/local";
import { listOutbox } from "./outbox";

/**
 * Sync engine.
 *  - pull(): downloads server rows newer than last sync into Dexie.
 *  - push(): drains the outbox to Supabase. Last-write-wins.
 *  - signature blobs: uploaded to Storage on push, then removed from local store.
 *
 * Strategy choices:
 *  - Polling kept simple (online + interval + on-demand trigger).
 *  - On RLS / 4xx errors we drop the outbox item with a console warning so the
 *    queue does not stall forever. Network errors keep the item for retry.
 */

let _running = false;
let _scheduled: number | null = null;
const listeners = new Set<() => void>();

export function onSyncChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

let _pendingFlag = false;
export function isSyncing(): boolean {
  return _running;
}

/** Schedule a sync run shortly (debounced). */
export function triggerSyncSoon(delayMs = 250) {
  if (typeof window === "undefined") return;
  if (_scheduled !== null) return;
  _scheduled = window.setTimeout(() => {
    _scheduled = null;
    void runSync();
  }, delayMs);
}

export async function runSync(): Promise<void> {
  if (_running) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session?.user) return;

  _running = true;
  notify();
  try {
    await pull(sess.session.user.id);
    await push(sess.session.user.id);
  } catch (err) {
    console.warn("[sync] run failed", err);
  } finally {
    _running = false;
    notify();
  }
}

// ───────────────────────── PULL ─────────────────────────

async function pull(userId: string) {
  const db = getDb();

  // Equipments + responsibles are global-readable; pull everything visible.
  const sinceEquip = (await getMeta("equipments:lastPull")) || "1970-01-01T00:00:00Z";
  const sinceResp = (await getMeta("responsibles:lastPull")) || "1970-01-01T00:00:00Z";
  const sinceEval = (await getMeta(`evaluations:lastPull:${userId}`)) || "1970-01-01T00:00:00Z";
  const sinceSeg = (await getMeta(`segments:lastPull:${userId}`)) || "1970-01-01T00:00:00Z";

  const [equipsRes, respsRes, evalsRes, segsRes] = await Promise.all([
    supabase
      .from("equipments")
      .select("id, user_id, name, brand, serial_number, notes, created_at, updated_at")
      .gt("updated_at", sinceEquip),
    supabase
      .from("responsibles")
      .select("id, user_id, name, role, registry, signature_url, created_at, updated_at")
      .gt("updated_at", sinceResp),
    supabase
      .from("evaluations")
      .select(
        "id, user_id, type, status, title, company, worker, estimated_duration_minutes, form_data, worker_signature_url, started_at, completed_at, created_at, updated_at",
      )
      .eq("user_id", userId)
      .gt("updated_at", sinceEval),
    supabase
      .from("time_segments")
      .select("id, evaluation_id, user_id, started_at, ended_at")
      .eq("user_id", userId)
      .gt("started_at", sinceSeg),
  ]);

  const nowIso = new Date().toISOString();

  if (equipsRes.data) {
    for (const r of equipsRes.data) {
      const local = await db.equipments.get(r.id);
      if (local?._pending) continue; // local edit wins until pushed
      await db.equipments.put({ ...(r as LocalEquipment), _pending: 0 });
    }
    await setMeta("equipments:lastPull", nowIso);
  }

  if (respsRes.data) {
    for (const r of respsRes.data) {
      const local = await db.responsibles.get(r.id);
      if (local?._pending) continue;
      await db.responsibles.put({ ...(r as LocalResponsible), _pending: 0 });
    }
    await setMeta("responsibles:lastPull", nowIso);
  }

  if (evalsRes.data) {
    for (const r of evalsRes.data) {
      const local = await db.evaluations.get(r.id);
      if (local?._pending) continue;
      await db.evaluations.put({
        ...(r as LocalEvaluation),
        form_data: (r.form_data as Record<string, string>) || {},
        _pending: 0,
      });
    }
    await setMeta(`evaluations:lastPull:${userId}`, nowIso);
  }

  if (segsRes.data) {
    for (const r of segsRes.data) {
      const local = await db.time_segments.get(r.id);
      if (local?._pending) continue;
      await db.time_segments.put({ ...(r as LocalTimeSegment), _pending: 0 });
    }
    await setMeta(`segments:lastPull:${userId}`, nowIso);
  }
}

// ───────────────────────── PUSH ─────────────────────────

async function push(userId: string) {
  const db = getDb();

  // 1) Upload pending signature blobs first; the row updates that reference
  //    the storage path are already in the outbox.
  const blobs = await db.signature_blobs.toArray();
  for (const sig of blobs) {
    try {
      const { error } = await supabase.storage
        .from("signatures")
        .upload(sig.path, sig.blob, { upsert: true, contentType: "image/png" });
      if (error) {
        console.warn("[sync] signature upload failed", sig.path, error.message);
        continue; // try again next run
      }
      await db.signature_blobs.delete(sig.path);
    } catch (err) {
      console.warn("[sync] signature upload threw", err);
    }
  }

  // 2) Drain outbox. Process in insertion order so inserts precede updates.
  const items = await listOutbox();
  for (const item of items) {
    try {
      let res;
      if (item.op === "delete") {
        res = await supabase.from(item.table).delete().eq("id", item.rowId);
      } else if (item.op === "insert") {
        // Upsert handles the case where a previous push partially succeeded
        // and we are retrying with the same id.
        res = await supabase.from(item.table).upsert(item.payload, { onConflict: "id" });
      } else {
        // update
        const { id, ...patch } = item.payload as Record<string, unknown> & { id: string };
        res = await supabase.from(item.table).update(patch).eq("id", id);
      }

      if (res.error) {
        const code = (res.error as { code?: string }).code;
        const isPermissionOrValidation =
          code === "42501" || code === "23502" || code === "23503" || code === "23514";
        if (isPermissionOrValidation) {
          console.warn(
            `[sync] dropping ${item.table}/${item.op}/${item.rowId} due to permanent error: ${res.error.message}`,
          );
          await db.outbox.delete(item.id!);
        } else {
          await db.outbox.update(item.id!, {
            retries: (item.retries ?? 0) + 1,
            last_error: res.error.message,
          });
          // Stop the run on transient errors to avoid hammering.
          break;
        }
      } else {
        await db.outbox.delete(item.id!);
        // Mark the local row as no longer pending.
        if (item.op !== "delete") {
          if (item.table === "evaluations") {
            const cur = await db.evaluations.get(item.rowId);
            if (cur) await db.evaluations.put({ ...cur, _pending: 0 });
          } else if (item.table === "time_segments") {
            const cur = await db.time_segments.get(item.rowId);
            if (cur) await db.time_segments.put({ ...cur, _pending: 0 });
          } else if (item.table === "equipments") {
            const cur = await db.equipments.get(item.rowId);
            if (cur) await db.equipments.put({ ...cur, _pending: 0 });
          } else if (item.table === "responsibles") {
            const cur = await db.responsibles.get(item.rowId);
            if (cur) await db.responsibles.put({ ...cur, _pending: 0 });
          }
        }
      }
    } catch (err) {
      console.warn("[sync] push item threw", err);
      await db.outbox.update(item.id!, {
        retries: (item.retries ?? 0) + 1,
        last_error: err instanceof Error ? err.message : String(err),
      });
      break;
    }
  }
  // Silence unused warning when the branch above never sets it
  void _pendingFlag;
}

// ───────────────────────── BOOT ─────────────────────────

let _booted = false;

export function startSyncLoop() {
  if (_booted || typeof window === "undefined") return;
  _booted = true;

  window.addEventListener("online", () => {
    notify();
    triggerSyncSoon(50);
  });
  window.addEventListener("offline", () => notify());

  // Periodic sync while online.
  window.setInterval(() => {
    if (navigator.onLine) void runSync();
  }, 30_000);

  triggerSyncSoon(500);
}
