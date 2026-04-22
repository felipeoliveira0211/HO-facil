import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser, Check } from "lucide-react";

interface SignaturePadProps {
  onSave: (dataUrl: string) => Promise<void> | void;
  existingUrl?: string | null;
}

export function SignaturePad({ onSave, existingUrl }: SignaturePadProps) {
  const ref = useRef<SignatureCanvas | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedPreview, setSavedPreview] = useState<string | null>(existingUrl ?? null);

  const clear = () => ref.current?.clear();

  const save = async () => {
    if (!ref.current || ref.current.isEmpty()) return;
    setSaving(true);
    try {
      const dataUrl = ref.current.getTrimmedCanvas().toDataURL("image/png");
      await onSave(dataUrl);
      setSavedPreview(dataUrl);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {savedPreview && (
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Assinatura registrada</p>
          <img src={savedPreview} alt="Assinatura" className="max-h-24 rounded bg-white p-2" />
        </div>
      )}
      <div className="rounded-lg border-2 border-dashed border-border bg-white">
        <SignatureCanvas
          ref={ref}
          penColor="#0f172a"
          canvasProps={{
            className: "w-full h-44 touch-none rounded-lg",
          }}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          <Eraser className="mr-1.5 h-4 w-4" /> Limpar
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          <Check className="mr-1.5 h-4 w-4" /> {saving ? "Salvando..." : "Salvar assinatura"}
        </Button>
      </div>
    </div>
  );
}
