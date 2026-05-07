import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { getDb, type LocalTimeSegment } from "@/lib/db/local";
import { newId } from "@/lib/db/uuid";
import { enqueue } from "@/lib/sync/outbox";
import { updateEvaluation } from "./evaluations";

export async function fetchSegmentsLocal(evaluationId: string): Promise<LocalTimeSegment[]> {
  const list = await getDb()
    .time_segments.where("evaluation_id")
    .equals(evaluationId)
    .toArray();
  return list.sort((a, b) => a.started_at.localeCompare(b.started_at));
}

export async function startTimerLocal(
  evaluationId: string,
  userId: string,
  startedAtOverride?: string,
) {
  const db = getDb();
  const nowDate = new Date();
  const now = nowDate.toISOString();
  // Use override only if it parses and is not in the future.
  let startedAt = now;
  if (startedAtOverride) {
    const t = new Date(startedAtOverride).getTime();
    if (!Number.isNaN(t) && t <= nowDate.getTime()) {
      startedAt = new Date(t).toISOString();
    }
  }
  // Defensive: close any open segment first.
  const open = await db.time_segments
    .where("evaluation_id")
    .equals(evaluationId)
    .filter((s) => s.ended_at === null)
    .toArray();
  for (const s of open) {
    await db.time_segments.put({ ...s, ended_at: now, _pending: 1 });
    await enqueue("time_segments", "update", s.id, { id: s.id, ended_at: now });
  }
  const id = newId();
  const row: LocalTimeSegment = {
    id,
    evaluation_id: evaluationId,
    user_id: userId,
    started_at: startedAt,
    ended_at: null,
    _pending: 1,
  };
  await db.time_segments.put(row);
  await enqueue("time_segments", "insert", id, {
    id,
    evaluation_id: evaluationId,
    user_id: userId,
    started_at: startedAt,
    ended_at: null,
  });

  const ev = await db.evaluations.get(evaluationId);
  if (ev) {
    await updateEvaluation(evaluationId, {
      status: "in_progress",
      started_at: ev.started_at ?? startedAt,
    });
  }
}

export async function pauseTimerLocal(evaluationId: string) {
  const db = getDb();
  const open = await db.time_segments
    .where("evaluation_id")
    .equals(evaluationId)
    .filter((s) => s.ended_at === null)
    .toArray();
  const now = new Date().toISOString();
  for (const s of open) {
    await db.time_segments.put({ ...s, ended_at: now, _pending: 1 });
    await enqueue("time_segments", "update", s.id, { id: s.id, ended_at: now });
  }
  await updateEvaluation(evaluationId, { status: "paused" });
}

export function useSegments(evaluationId: string | undefined) {
  const [list, setList] = useState<LocalTimeSegment[]>([]);
  useEffect(() => {
    if (!evaluationId) return;
    const sub = liveQuery(async () => fetchSegmentsLocal(evaluationId)).subscribe({
      next: setList,
      error: (e) => console.error("[useSegments]", e),
    });
    return () => sub.unsubscribe();
  }, [evaluationId]);
  return list;
}
