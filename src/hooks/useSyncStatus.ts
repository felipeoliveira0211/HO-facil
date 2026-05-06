import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { getDb } from "@/lib/db/local";
import { isSyncing, onSyncChange } from "@/lib/sync/engine";

export interface SyncStatus {
  pending: number;
  syncing: boolean;
}

export function useSyncStatus(): SyncStatus {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(isSyncing());

  useEffect(() => {
    const sub = liveQuery(async () => {
      const ob = await getDb().outbox.count();
      const blobs = await getDb().signature_blobs.count();
      return ob + blobs;
    }).subscribe({
      next: setPending,
      error: () => setPending(0),
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    return onSyncChange(() => setSyncing(isSyncing()));
  }, []);

  return { pending, syncing };
}
