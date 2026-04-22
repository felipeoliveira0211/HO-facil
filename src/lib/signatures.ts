import { supabase } from "@/integrations/supabase/client";

export async function fetchSignatureDataUrl(path: string): Promise<string | undefined> {
  const { data } = await supabase.storage.from("signatures").createSignedUrl(path, 60);
  if (!data?.signedUrl) return undefined;
  const res = await fetch(data.signedUrl);
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

export async function fetchResponsibleSignature(
  responsibleId: string | undefined,
): Promise<string | undefined> {
  if (!responsibleId) return undefined;
  const { data } = await supabase
    .from("responsibles")
    .select("signature_url")
    .eq("id", responsibleId)
    .maybeSingle();
  if (!data?.signature_url) return undefined;
  return fetchSignatureDataUrl(data.signature_url);
}
