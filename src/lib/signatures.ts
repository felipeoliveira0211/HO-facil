import { supabase } from "@/integrations/supabase/client";

export async function getSignedSignatureUrl(path: string): Promise<string | undefined> {
  const { data } = await supabase.storage.from("signatures").createSignedUrl(path, 600);
  return data?.signedUrl;
}

export async function fetchSignatureDataUrl(path: string): Promise<string | undefined> {
  const signedUrl = await getSignedSignatureUrl(path);
  if (!signedUrl) return undefined;
  const res = await fetch(signedUrl);
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

export async function fetchResponsibleSignature(
  responsibleId: string | undefined,
  responsibleLabel?: string | undefined,
): Promise<string | undefined> {
  let signaturePath: string | null | undefined;

  if (responsibleId) {
    const { data } = await supabase
      .from("responsibles")
      .select("signature_url")
      .eq("id", responsibleId)
      .maybeSingle();
    signaturePath = data?.signature_url;
  }

  if (!signaturePath && responsibleLabel) {
    const normalizedName = responsibleLabel.split(" — ")[0]?.trim();
    if (normalizedName) {
      const { data } = await supabase
        .from("responsibles")
        .select("signature_url")
        .eq("name", normalizedName)
        .not("signature_url", "is", null)
        .limit(1)
        .maybeSingle();
      signaturePath = data?.signature_url;
    }
  }

  if (!signaturePath) return undefined;
  return fetchSignatureDataUrl(signaturePath);
}
