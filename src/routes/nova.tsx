import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FlaskConical, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { createEvaluation } from "@/lib/repo/evaluations";

export const Route = createFileRoute("/nova")({
  component: NewEvaluationPage,
});

function NewEvaluationPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [type, setType] = useState<"chemical" | "noise">("chemical");
  const [company, setCompany] = useState("");
  const [worker, setWorker] = useState("");
  const [duration, setDuration] = useState(480);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const id = await createEvaluation(user.id, {
        type,
        company,
        worker,
        estimated_duration_minutes: duration,
        title: `${worker} — ${company}`,
      });
      toast.success("Avaliação criada");
      router.navigate({ to: "/avaliacao/$id", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight">Nova avaliação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina o tipo, dados básicos e tempo estimado. Você poderá detalhar tudo depois.
        </p>

        <form onSubmit={create} className="mt-8 space-y-6">
          <div>
            <Label className="mb-2.5 block">Tipo de monitoramento</Label>
            <div className="grid grid-cols-2 gap-3">
              <TypeButton
                active={type === "chemical"}
                onClick={() => setType("chemical")}
                Icon={FlaskConical}
                label="Agentes Químicos"
                gradient="bg-gradient-chemical"
              />
              <TypeButton
                active={type === "noise"}
                onClick={() => setType("noise")}
                Icon={Volume2}
                label="Ruído"
                gradient="bg-gradient-noise"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="company">Empresa</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="worker">Trabalhador</Label>
              <Input id="worker" value={worker} onChange={(e) => setWorker(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dur">Tempo estimado da avaliação (minutos)</Label>
            <Input id="dur" type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} required />
            <p className="text-xs text-muted-foreground">Padrão: 480 min (jornada de 8 h). O cronômetro mostrará quanto falta.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => router.navigate({ to: "/" })}>Cancelar</Button>
            <Button type="submit" disabled={busy} className="shadow-glow">
              {busy ? "Criando..." : "Criar e abrir"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function TypeButton({ active, onClick, Icon, label, gradient }: {
  active: boolean; onClick: () => void;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string; gradient: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`group relative flex flex-col items-start gap-3 overflow-hidden rounded-xl border-2 p-4 text-left transition ${
        active ? "border-primary shadow-glow" : "border-border hover:border-foreground/20 bg-card"
      }`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${gradient}`}>
        <Icon className="h-5 w-5 text-white" strokeWidth={2.4} />
      </div>
      <div>
        <p className="font-display text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{label === "Ruído" ? "Dosimetria sonora" : "Bombas amostradoras"}</p>
      </div>
    </button>
  );
}
