import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { getDb, type LocalResponsible } from "@/lib/db/local";
import { newId } from "@/lib/db/uuid";
import { enqueue } from "@/lib/sync/outbox";

export type ResponsibleInput = Pick<LocalResponsible, "name" | "role" | "registry">;

export async function createResponsible(userId: string, input: ResponsibleInput) {
  const now = new Date().toISOString();
  const row: LocalResponsible = {
    id: newId(),
    user_id: userId,
    name: input.name,
    role: input.role,
    registry: input.registry,
    signature_url: null,
    created_at: now,
    updated_at: now,
    _pending: 1,
  };
  await getDb().responsibles.put(row);
  await enqueue("responsibles", "insert", row.id, {
    id: row.id,
    user_id: userId,
    name: input.name,
    role: input.role,
    registry: input.registry,
  });
  return row.id;
}

export async function updateResponsible(id: string, patch: Partial<LocalResponsible>) {
  const db = getDb();
  const cur = await db.responsibles.get(id);
  if (!cur) return;
  const next: LocalResponsible = {
    ...cur,
    ...patch,
    updated_at: new Date().toISOString(),
    _pending: 1,
  };
  await db.responsibles.put(next);
  const allowed = ["name", "role", "registry", "signature_url"] as const;
  const payload: Record<string, unknown> = { id };
  for (const k of allowed) if (k in patch) payload[k] = (patch as Record<string, unknown>)[k];
  await enqueue("responsibles", "update", id, payload);
}

export async function deleteResponsible(id: string) {
  await getDb().responsibles.delete(id);
  await enqueue("responsibles", "delete", id, { id });
}

export function useResponsibles() {
  const [list, setList] = useState<LocalResponsible[]>([]);
  useEffect(() => {
    const sub = liveQuery(async () => {
      const all = await getDb().responsibles.toArray();
      return all.sort((a, b) => a.name.localeCompare(b.name));
    }).subscribe({ next: setList, error: (e) => console.error("[useResponsibles]", e) });
    return () => sub.unsubscribe();
  }, []);
  return list;
}

export async function getResponsible(id: string) {
  return getDb().responsibles.get(id);
}
