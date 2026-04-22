import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, User, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/SignaturePad";

export const Route = createFileRoute("/responsaveis")({ component: RespPage });

interface Resp {
  id: string;
  name: string;
  role: string | null;
  registry: string | null;
  signature_url: string | null;
}

function RespPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Resp[]>([]);
  const [signedPreviews, setSignedPreviews] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Partial<Resp> | null>(null);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("responsibles")
      .select("id, name, role, registry, signature_url")
      .order("name");
    const list = (data ?? []) as Resp[];
    setItems(list);
    // Preload signed urls for previews
    const previews: Record<string, string> = {};
    await Promise.all(
      list
        .filter((r) => r.signature_url)
        .map(async (r) => {
          const { data: s } = await supabase.storage
            .from("signatures")
            .createSignedUrl(r.signature_url as string, 600);
          if (s?.signedUrl) previews[r.id] = s.signedUrl;
        }),
    );
    setSignedPreviews(previews);
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const save = async () => {
    if (!editing || !user) return;
    if (!editing.name?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (editing.id) {
      const { error } = await supabase
        .from("responsibles")
        .update({
          name: editing.name,
          role: editing.role ?? null,
          registry: editing.registry ?? null,
        })
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("responsibles").insert({
        user_id: user.id,
        name: editing.name,
        role: editing.role ?? null,
        registry: editing.registry ?? null,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("Salvo");
    setEditing(null);
    load();
  };

  const saveSignatureFor = async (respId: string, dataUrl: string) => {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${user!.id}/responsibles/${respId}.png`;
    const { error: upErr } = await supabase.storage
      .from("signatures")
      .upload(path, blob, { upsert: true, contentType: "image/png" });
    if (upErr) {
      toast.error(`Falha no upload: ${upErr.message}`);
      return;
    }
    const { error } = await supabase
      .from("responsibles")
      .update({ signature_url: path })
      .eq("id", respId);
    if (error) return toast.error(error.message);
    toast.success("Assinatura salva");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir responsável?")) return;
    await supabase.from("responsibles").delete().eq("id", id);
    load();
  };

  if (loading || !user) return null;

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Responsáveis</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre técnicos com assinatura para reutilizar nas avaliações.
          </p>
        </div>
        {!editing && (
          <Button onClick={() => setEditing({})} className="shadow-glow">
            <Plus className="mr-1.5 h-4 w-4" /> Novo
          </Button>
        )}
      </div>

      {editing && (
        <div className="mb-6 rounded-2xl border bg-card p-5 shadow-card">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome *</Label>
              <Input
                value={editing.name || ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Função</Label>
              <Input
                value={editing.role || ""}
                onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                placeholder="Ex.: Engº de Segurança"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Registro profissional</Label>
              <Input
                value={editing.registry || ""}
                onChange={(e) => setEditing({ ...editing, registry: e.target.value })}
                placeholder="CREA / MTE"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={save}>
              <Save className="mr-1.5 h-4 w-4" /> Salvar
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              <X className="mr-1.5 h-4 w-4" /> Cancelar
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Após salvar, registre a assinatura na lista abaixo.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 && !editing ? (
          <p className="rounded-xl border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            Nenhum responsável cadastrado.
          </p>
        ) : (
          items.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-4 shadow-card">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[r.role, r.registry].filter(Boolean).join(" • ") || "—"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(r.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3">
                <Label className="text-xs font-medium">Assinatura</Label>
                <SignaturePad
                  existingUrl={signedPreviews[r.id] ?? null}
                  onSave={async (dataUrl) => {
                    await saveSignatureFor(r.id, dataUrl);
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
