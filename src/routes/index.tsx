import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { EvaluationCard, type EvaluationCardData } from "@/components/EvaluationCard";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList } from "lucide-react";
import { useEvaluations } from "@/lib/repo/evaluations";
import { liveQuery } from "dexie";
import { getDb, type LocalTimeSegment } from "@/lib/db/local";

export const Route = createFileRoute("/")({ component: DashboardPage });

function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const evaluations = useEvaluations({ userId: user?.id, excludeCompleted: true });
  const [segmentsByEval, setSegmentsByEval] = useState<Record<string, LocalTimeSegment[]>>({});

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  useEffect(() => {
    const sub = liveQuery(async () => getDb().time_segments.toArray()).subscribe({
      next: (all) => {
        const grouped: Record<string, LocalTimeSegment[]> = {};
        for (const s of all) (grouped[s.evaluation_id] ||= []).push(s);
        setSegmentsByEval(grouped);
      },
    });
    return () => sub.unsubscribe();
  }, []);

  if (loading || !user) return null;

  const items: EvaluationCardData[] = evaluations.map((e) => ({
    id: e.id,
    type: e.type,
    status: e.status,
    title: e.title,
    company: e.company,
    worker: e.worker,
    estimated_duration_minutes: e.estimated_duration_minutes,
    form_data: e.form_data,
    segments: segmentsByEval[e.id] || [],
    pending: !!e._pending,
  }));

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

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ev) => <EvaluationCard key={ev.id} evaluation={ev} onChange={() => {}} />)}
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
        Crie sua primeira folha de campo digital. Você pode preencher gradualmente conforme a demanda.
      </p>
      <Link to="/nova" className="mt-5 inline-block">
        <Button className="shadow-glow"><Plus className="mr-1.5 h-4 w-4" /> Nova avaliação</Button>
      </Link>
    </div>
  );
}
