import { getDb, type LocalSignatureBlob } from "@/lib/db/local";
import { updateEvaluation } from "./evaluations";
import { updateResponsible } from "./responsibles";
import { triggerSyncSoon } from "@/lib/sync/engine";

/**
 * Save a signature locally first (as a blob) and immediately point the owning
 * row at the destination storage path. The sync engine uploads the blob to
 * Supabase Storage when online; if upload fails the blob stays in the queue
 * and is retried later. The local URL is generated on demand for previews.
 */

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function saveEvaluationSignature(
  userId: string,
  evaluationId: string,
  dataUrl: string,
): Promise<string> {
  const blob = await dataUrlToBlob(dataUrl);
  const path = `${userId}/${evaluationId}.png`;
  const row: LocalSignatureBlob = {
    path,
    blob,
    kind: "evaluation",
    ownerId: evaluationId,
    user_id: userId,
    created_at: new Date().toISOString(),
  };
  await getDb().signature_blobs.put(row);
  await updateEvaluation(evaluationId, { worker_signature_url: path });
  triggerSyncSoon();
  return path;
}

export async function saveResponsibleSignature(
  userId: string,
  responsibleId: string,
  dataUrl: string,
): Promise<string> {
  const blob = await dataUrlToBlob(dataUrl);
  const path = `${userId}/responsibles/${responsibleId}.png`;
  const row: LocalSignatureBlob = {
    path,
    blob,
    kind: "responsible",
    ownerId: responsibleId,
    user_id: userId,
    created_at: new Date().toISOString(),
  };
  await getDb().signature_blobs.put(row);
  await updateResponsible(responsibleId, { signature_url: path });
  triggerSyncSoon();
  return path;
}

/**
 * Resolve a signature path to a usable image URL.
 * - If the blob exists locally (not yet synced) returns an object URL.
 * - Otherwise creates a Supabase signed URL.
 */
export async function resolveSignatureUrl(path: string | null | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  const local = await getDb().signature_blobs.get(path);
  if (local) return URL.createObjectURL(local.blob);
  const { getSignedSignatureUrl } = await import("@/lib/signatures");
  return getSignedSignatureUrl(path);
}

export async function resolveSignatureDataUrl(path: string | null | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  const local = await getDb().signature_blobs.get(path);
  if (local) {
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(local.blob);
    });
  }
  const { fetchSignatureDataUrl } = await import("@/lib/signatures");
  return fetchSignatureDataUrl(path);
}

export async function resolveResponsibleSignatureDataUrl(
  responsibleId: string | undefined,
  responsibleLabel: string | undefined,
): Promise<string | undefined> {
  if (responsibleId) {
    const r = await getDb().responsibles.get(responsibleId);
    const direct = await resolveSignatureDataUrl(r?.signature_url);
    if (direct) return direct;
  }
  if (responsibleLabel) {
    const normalizedName = responsibleLabel.split(" — ")[0]?.trim();
    if (normalizedName) {
      const all = await getDb().responsibles.toArray();
      const match = all.find((r) => r.name === normalizedName && r.signature_url);
      const local = await resolveSignatureDataUrl(match?.signature_url);
      if (local) return local;
    }
  }
  // Final fallback: legacy server-side lookup
  const { fetchResponsibleSignature } = await import("@/lib/signatures");
  return fetchResponsibleSignature(responsibleId, responsibleLabel);
}
