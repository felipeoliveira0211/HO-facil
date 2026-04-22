import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Wrench, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/equipamentos")({ component: EquipPage });

interface Equip {
  id: string;
  name: string;
  brand: string | null;
  serial_number: string | null;
  notes: string | null;
}

function EquipPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Equip[]>([]);
  const [editing, setEditing] = useState<Partial<Equip> | null>(null);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("equipments")
      .select("id, name, brand, serial_number, notes")
      .order("name");
    setItems((data ?? []) as Equip[]);
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
        .from("equipments")
        .update({
          name: editing.name,
          brand: editing.brand ?? null,
          serial_number: editing.serial_number ?? null,
          notes: editing.notes ?? null,
        })
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("equipments").insert({
        user_id: user.id,
        name: editing.name,
        brand: editing.brand ?? null,
        serial_number: editing.serial_number ?? null,
        notes: editing.notes ?? null,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("Salvo");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir equipamento?")) return;
    await supabase.from("equipments").delete().eq("id", id);
    load();
  };

  if (loading || !user) return null;

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Equipamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre amostradores, dosímetros e demais equipamentos.
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome *</Label>
              <Input
                value={editing.name || ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Ex.: Bomba SKC AirChek"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Marca</Label>
              <Input
                value={editing.brand || ""}
                onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Número de série</Label>
              <Input
                value={editing.serial_number || ""}
                onChange={(e) => setEditing({ ...editing, serial_number: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium">Observações</Label>
              <Textarea
                rows={2}
                value={editing.notes || ""}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
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
        </div>
      )}

      <div className="space-y-2">
        {items.length === 0 && !editing ? (
          <p className="rounded-xl border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            Nenhum equipamento cadastrado.
          </p>
        ) : (
          items.map((eq) => (
            <div
              key={eq.id}
              className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-card"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Wrench className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{eq.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[eq.brand, eq.serial_number && `S/N ${eq.serial_number}`]
                    .filter(Boolean)
                    .join(" • ") || "—"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(eq)}>
                Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove(eq.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
