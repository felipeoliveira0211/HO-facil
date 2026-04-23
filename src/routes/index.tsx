import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { EvaluationCard, type EvaluationCardData } from "@/components/EvaluationCard";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<EvaluationCardData[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    const { data: evals } = await supabase
      .from("evaluations")
      .select("id, type, status, title, company, worker, estimated_duration_minutes, form_data")
      .eq("user_id", user.id)
      .neq("status", "completed")
      .order("updated_at", { ascending: false });

    const ids = (evals ?? []).map((e) => e.id);
    let segments: Array<{
      id: string;
      evaluation_id: string;
      started_at: string;
      ended_at: string | null;
    }> = [];
    if (ids.length) {
      const { data } = await supabase
        .from("time_segments")
        .select("id, evaluation_id, started_at, ended_at")
        .in("evaluation_id", ids);
      segments = data ?? [];
    }

    setItems(
      (evals ?? []).map((e) => ({
        ...e,
        form_data: (e.form_data as Record<string, string>) || {},
        segments: segments.filter((s) => s.evaluation_id === e.id),
      })),
    );
    setFetching(false);
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading || !user) return null;

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-3xl font-bold tracking-tight text-balance">
            Avaliações em andamento
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe o cronômetro de cada monitoramento. Pause quando o trabalhador se ausentar.
          </p>
        </div>
        <Link to="/nova" className="shrink-0">
          <Button className="shadow-glow">
            <Plus className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Nova avaliação</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </Link>
      </div>

      {fetching ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ev) => (
            <EvaluationCard key={ev.id} evaluation={ev} onChange={load} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 p-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
        <ClipboardList className="h-7 w-7 text-primary-foreground" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">Nenhuma avaliação em aberto</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Crie sua primeira folha de campo digital. Você pode preencher gradualmente conforme a
        demanda.
      </p>
      <Link to="/nova" className="mt-5 inline-block">
        <Button className="shadow-glow">
          <Plus className="mr-1.5 h-4 w-4" /> Nova avaliação
        </Button>
      </Link>
    </div>
  );
}
