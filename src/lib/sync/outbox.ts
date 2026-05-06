import { getDb, type OutboxItem, type OutboxOp, type OutboxTable } from "@/lib/db/local";
import { triggerSyncSoon } from "./engine";

/**
 * Append a write to the outbox. Multiple updates for the same row collapse
 * into a single payload (last-write-wins) to keep the queue bounded.
 */
export async function enqueue(
  table: OutboxTable,
  op: OutboxOp,
  rowId: string,
  payload: Record<string, unknown>,
) {
  const db = getDb();
  if (op === "update") {
    const existing = await db.outbox.where("rowId").equals(rowId).toArray();
    const updates = existing.filter((x) => x.table === table && x.op === "update");
    if (updates.length) {
      const merged = updates.reduce<Record<string, unknown>>(
        (acc, x) => ({ ...acc, ...(x.payload as Record<string, unknown>) }),
        {},
      );
      const next = { ...merged, ...payload };
      // Replace the most recent update with the merged payload, drop the rest.
      const keep = updates[updates.length - 1];
      await db.outbox.update(keep.id!, {
        payload: next,
        created_at: new Date().toISOString(),
        retries: 0,
        last_error: undefined,
      });
      for (const u of updates.slice(0, -1)) await db.outbox.delete(u.id!);
      triggerSyncSoon();
      return;
    }
  }
  const item: OutboxItem = {
    table,
    op,
    rowId,
    payload,
    created_at: new Date().toISOString(),
    retries: 0,
  };
  await db.outbox.add(item);
  triggerSyncSoon();
}

export async function pendingCount(): Promise<number> {
  return getDb().outbox.count();
}

export async function listOutbox(): Promise<OutboxItem[]> {
  return getDb().outbox.orderBy("id").toArray();
}
