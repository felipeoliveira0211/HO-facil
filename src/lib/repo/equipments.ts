import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { getDb, type LocalEquipment } from "@/lib/db/local";
import { newId } from "@/lib/db/uuid";
import { enqueue } from "@/lib/sync/outbox";

export type EquipmentInput = Pick<LocalEquipment, "name" | "brand" | "serial_number" | "notes">;

export async function createEquipment(userId: string, input: EquipmentInput) {
  const now = new Date().toISOString();
  const row: LocalEquipment = {
    id: newId(),
    user_id: userId,
    name: input.name,
    brand: input.brand,
    serial_number: input.serial_number,
    notes: input.notes,
    created_at: now,
    updated_at: now,
    _pending: 1,
  };
  await getDb().equipments.put(row);
  await enqueue("equipments", "insert", row.id, {
    id: row.id,
    user_id: userId,
    name: input.name,
    brand: input.brand,
    serial_number: input.serial_number,
    notes: input.notes,
  });
  return row.id;
}

export async function updateEquipment(id: string, patch: Partial<EquipmentInput>) {
  const db = getDb();
  const cur = await db.equipments.get(id);
  if (!cur) return;
  const next: LocalEquipment = {
    ...cur,
    ...patch,
    updated_at: new Date().toISOString(),
    _pending: 1,
  };
  await db.equipments.put(next);
  await enqueue("equipments", "update", id, { id, ...patch });
}

export async function deleteEquipment(id: string) {
  await getDb().equipments.delete(id);
  await enqueue("equipments", "delete", id, { id });
}

export function useEquipments() {
  const [list, setList] = useState<LocalEquipment[]>([]);
  useEffect(() => {
    const sub = liveQuery(async () => {
      const all = await getDb().equipments.toArray();
      return all.sort((a, b) => a.name.localeCompare(b.name));
    }).subscribe({ next: setList, error: (e) => console.error("[useEquipments]", e) });
    return () => sub.unsubscribe();
  }, []);
  return list;
}
