import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, User, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/SignaturePad";
import { createResponsible, deleteResponsible, updateResponsible, useResponsibles } from "@/lib/repo/responsibles";
import { saveResponsibleSignature, resolveSignatureUrl } from "@/lib/repo/signatures";
import type { LocalResponsible } from "@/lib/db/local";

export const Route = createFileRoute("/responsaveis")({ component: RespPage });

function RespPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const items = useResponsibles();
  const [signedPreviews, setSignedPreviews] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Partial<LocalResponsible> | null>(null);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const previews: Record<string, string> = {};
      await Promise.all(items.filter(r => r.signature_url).map(async (r) => {
        const url = await resolveSignatureUrl(r.signature_url);
        if (url) previews[r.id] = url;
      }));
      if (!cancelled) setSignedPreviews(previews);
    })();
    return () => { cancelled = true; };
  }, [items]);

  const save = async () => {
    if (!editing || !user) return;
    if (!editing.name?.trim()) { toast.error("Nome é obrigatório"); return; }
    if (editing.id) {
      await updateResponsible(editing.id, { name: editing.name, role: editing.role ?? null, registry: editing.registry ?? null });
    } else {
      await createResponsible(user.id, { name: editing.name, role: editing.role ?? null, registry: editing.registry ?? null });
    }
    toast.success("Salvo");
    setEditing(null);
  };

  const saveSignatureFor = async (respId: string, dataUrl: string) => {
    if (!user) return;
    await saveResponsibleSignature(user.id, respId, dataUrl);
    toast.success("Assinatura salva");
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir responsável?")) return;
    await deleteResponsible(id);
  };

  if (loading || !user) return null;

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Responsáveis</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cadastre técnicos com assinatura para reutilizar nas avaliações.</p>
        </div>
        {!editing && <Button onClick={() => setEditing({})} className="shadow-glow"><Plus className="mr-1.5 h-4 w-4" /> Novo</Button>}
      </div>

      {editing && (
        <div className="mb-6 rounded-2xl border bg-card p-5 shadow-card">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome *</Label>
              <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Função</Label>
              <Input value={editing.role || ""} onChange={(e) => setEditing({ ...editing, role: e.target.value })} placeholder="Ex.: Engº de Segurança" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Registro profissional</Label>
              <Input value={editing.registry || ""} onChange={(e) => setEditing({ ...editing, registry: e.target.value })} placeholder="CREA / MTE" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={save}><Save className="mr-1.5 h-4 w-4" /> Salvar</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}><X className="mr-1.5 h-4 w-4" /> Cancelar</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Após salvar, registre a assinatura na lista abaixo.</p>
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 && !editing ? (
          <p className="rounded-xl border bg-card/40 p-8 text-center text-sm text-muted-foreground">Nenhum responsável cadastrado.</p>
        ) : (
          items.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-4 shadow-card">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary"><User className="h-5 w-5 text-muted-foreground" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{[r.role, r.registry].filter(Boolean).join(" • ") || "—"}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(r.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="mt-3">
                <Label className="text-xs font-medium">Assinatura</Label>
                <SignaturePad existingUrl={signedPreviews[r.id] ?? null} onSave={async (dataUrl) => { await saveSignatureFor(r.id, dataUrl); }} />
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
