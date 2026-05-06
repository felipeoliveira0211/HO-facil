import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { getDb, type LocalEvaluation } from "@/lib/db/local";
import { newId } from "@/lib/db/uuid";
import { enqueue } from "@/lib/sync/outbox";

/**
 * Repository for evaluations. All reads come from IndexedDB so the UI works
 * offline; all writes are persisted locally and queued for the server.
 */

export type EvaluationInput = Pick<
  LocalEvaluation,
  "type" | "company" | "worker" | "estimated_duration_minutes"
> & { title?: string | null };

export async function createEvaluation(userId: string, input: EvaluationInput): Promise<string> {
  const now = new Date().toISOString();
  const row: LocalEvaluation = {
    id: newId(),
    user_id: userId,
    type: input.type,
    status: "draft",
    title: input.title ?? `${input.worker ?? ""} — ${input.company ?? ""}`,
    company: input.company,
    worker: input.worker,
    estimated_duration_minutes: input.estimated_duration_minutes,
    form_data: {},
    worker_signature_url: null,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
    _pending: 1,
  };
  await getDb().evaluations.put(row);
  await enqueue("evaluations", "insert", row.id, {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    status: row.status,
    title: row.title,
    company: row.company,
    worker: row.worker,
    estimated_duration_minutes: row.estimated_duration_minutes,
    form_data: row.form_data,
  });
  return row.id;
}

export async function updateEvaluation(
  id: string,
  patch: Partial<LocalEvaluation>,
): Promise<void> {
  const db = getDb();
  const cur = await db.evaluations.get(id);
  if (!cur) return;
  const next: LocalEvaluation = {
    ...cur,
    ...patch,
    updated_at: new Date().toISOString(),
    _pending: 1,
  };
  await db.evaluations.put(next);
  // Send only mutable fields to the server.
  const payload: Record<string, unknown> = { id };
  for (const k of [
    "status",
    "company",
    "worker",
    "title",
    "estimated_duration_minutes",
    "form_data",
    "worker_signature_url",
    "started_at",
    "completed_at",
  ] as const) {
    if (k in patch) payload[k] = (next as Record<string, unknown>)[k];
  }
  await enqueue("evaluations", "update", id, payload);
}

export async function deleteEvaluation(id: string): Promise<void> {
  const db = getDb();
  await db.evaluations.delete(id);
  await db.time_segments.where("evaluation_id").equals(id).delete();
  await enqueue("evaluations", "delete", id, { id });
}

export async function getEvaluation(id: string): Promise<LocalEvaluation | undefined> {
  return getDb().evaluations.get(id);
}

export function useEvaluations(filter?: {
  userId?: string;
  excludeCompleted?: boolean;
  onlyCompleted?: boolean;
}) {
  const [items, setItems] = useState<LocalEvaluation[]>([]);
  useEffect(() => {
    const sub = liveQuery(async () => {
      let coll = getDb().evaluations.toCollection();
      const all = await coll.toArray();
      let filtered = filter?.userId ? all.filter((e) => e.user_id === filter.userId) : all;
      if (filter?.excludeCompleted) filtered = filtered.filter((e) => e.status !== "completed");
      if (filter?.onlyCompleted) filtered = filtered.filter((e) => e.status === "completed");
      filtered.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
      return filtered;
    }).subscribe({
      next: setItems,
      error: (e) => console.error("[useEvaluations]", e),
    });
    return () => sub.unsubscribe();
  }, [filter?.userId, filter?.excludeCompleted, filter?.onlyCompleted]);
  return items;
}

export function useEvaluation(id: string | undefined) {
  const [ev, setEv] = useState<LocalEvaluation | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    const sub = liveQuery(() => getDb().evaluations.get(id)).subscribe({
      next: setEv,
      error: (e) => console.error("[useEvaluation]", e),
    });
    return () => sub.unsubscribe();
  }, [id]);
  return ev;
}
