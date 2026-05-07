import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Play, Pause, Save, CheckCircle2, FlaskConical, Volume2, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { computeElapsedSeconds, isRunning } from "@/lib/timer";
import { formatDuration, formatRemaining } from "@/lib/format";
import { ChemicalForm } from "@/components/ChemicalForm";
import { NoiseForm } from "@/components/NoiseForm";
import { SignaturePad } from "@/components/SignaturePad";
import { generateEvaluationPdf } from "@/lib/pdf";
import { deriveTimes, toLocalTime } from "@/lib/timer-segments";
import { useEvaluation, updateEvaluation, deleteEvaluation } from "@/lib/repo/evaluations";
import { useSegments, pauseTimerLocal, startTimerLocal, fetchSegmentsLocal } from "@/lib/repo/segments";
import { saveEvaluationSignature, resolveSignatureUrl, resolveSignatureDataUrl, resolveResponsibleSignatureDataUrl } from "@/lib/repo/signatures";

const getNowLocalTime = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};

/** Converts "HH:MM" entered today to an ISO timestamp. Returns undefined if invalid or in the future. */
const localTimeToTodayISO = (hhmm: string | undefined): string | undefined => {
  if (!hhmm) return undefined;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return undefined;
  const h = Number(m[1]); const min = Number(m[2]);
  if (h > 23 || min > 59) return undefined;
  const d = new Date();
  d.setHours(h, min, 0, 0);
  if (d.getTime() > Date.now()) return undefined;
  return d.toISOString();
};

export const Route = createFileRoute("/avaliacao/$id")({ component: EvaluationPage });

function EvaluationPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const evaluation = useEvaluation(id);
  const segments = useSegments(id);
  const [workerSignaturePreview, setWorkerSignaturePreview] = useState<string | null>(null);
  const [, tick] = useState(0);
  const saveTimer = useRef<number | null>(null);
  const overtimeWarned = useRef(false);
  const [localPatch, setLocalPatch] = useState<{ company?: string; worker?: string; estimated_duration_minutes?: number; form_data?: Record<string, string> } | null>(null);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  // Compute view (local pending edits override the persisted row)
  const view = evaluation ? {
    ...evaluation,
    company: localPatch?.company ?? evaluation.company,
    worker: localPatch?.worker ?? evaluation.worker,
    estimated_duration_minutes: localPatch?.estimated_duration_minutes ?? evaluation.estimated_duration_minutes,
    form_data: localPatch?.form_data ?? evaluation.form_data,
  } : null;

  // Resolve worker signature preview
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await resolveSignatureUrl(evaluation?.worker_signature_url);
      if (!cancelled) setWorkerSignaturePreview(url ?? null);
    })();
    return () => { cancelled = true; };
  }, [evaluation?.worker_signature_url]);

  const running = isRunning(segments);

  useEffect(() => {
    if (!running) return;
    const i = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(i);
  }, [running]);

  useEffect(() => {
    if (!view) return;
    const total = view.estimated_duration_minutes * 60;
    const elapsed = computeElapsedSeconds(segments);
    if (elapsed > total && !overtimeWarned.current) {
      overtimeWarned.current = true;
      toast.warning("O tempo estimado foi ultrapassado. A medição continua ativa.");
    }
    if (elapsed <= total) overtimeWarned.current = false;
  }, [segments, view]);

  // Debounced autosave: pushes localPatch -> Dexie + outbox
  const scheduleSave = useCallback((patch: typeof localPatch) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      if (!patch) return;
      await updateEvaluation(id, patch);
    }, 800);
  }, [id]);

  // Auto-fill hora_inicio / intervalos / hora_fim from real segments
  useEffect(() => {
    if (!view) return;
    const fd = view.form_data;
    if (segments.length === 0) {
      if (!fd.hora_inicio) {
        const next = { ...fd, hora_inicio: getNowLocalTime() };
        const patch = { ...(localPatch ?? {}), form_data: next };
        setLocalPatch(patch); scheduleSave(patch);
      }
      return;
    }
    const t = deriveTimes(segments);
    const updates: Record<string, string> = {};
    if (t.startedAt && !fd.hora_inicio) updates.hora_inicio = toLocalTime(t.startedAt);
    const lastInterval = t.intervals[t.intervals.length - 1];
    if (lastInterval) {
      const ni = toLocalTime(lastInterval.from), nf = toLocalTime(lastInterval.to);
      if (fd.intervalo_inicio !== ni) updates.intervalo_inicio = ni;
      if (fd.intervalo_fim !== nf) updates.intervalo_fim = nf;
    } else {
      if (fd.intervalo_inicio) updates.intervalo_inicio = "";
      if (fd.intervalo_fim) updates.intervalo_fim = "";
    }
    if (t.endedAt && !running) {
      const nh = toLocalTime(t.endedAt);
      if (fd.hora_fim !== nh) updates.hora_fim = nh;
    } else if (running && fd.hora_fim) updates.hora_fim = "";
    if (Object.keys(updates).length === 0) return;
    const next = { ...fd, ...updates };
    const patch = { ...(localPatch ?? {}), form_data: next };
    setLocalPatch(patch); scheduleSave(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, running]);

  if (loading || !user || !view) {
    return <AppShell><div className="h-96 animate-pulse rounded-2xl bg-muted/60" /></AppShell>;
  }

  const isChem = view.type === "chemical";
  const Icon = isChem ? FlaskConical : Volume2;
  const elapsed = computeElapsedSeconds(segments);
  const total = view.estimated_duration_minutes * 60;
  const remaining = total - elapsed;
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));

  const updateField = (key: string, value: string) => {
    const fd = { ...view.form_data, [key]: value };
    const patch = { ...(localPatch ?? {}), form_data: fd };
    setLocalPatch(patch); scheduleSave(patch);
  };

  const setTopField = (key: "company" | "worker" | "estimated_duration_minutes", value: string | number) => {
    const patch = { ...(localPatch ?? {}), [key]: value } as typeof localPatch;
    setLocalPatch(patch); scheduleSave(patch);
  };

  const toggleTimer = async () => {
    try {
      if (running) await pauseTimerLocal(id);
      else {
        // If user entered hora_inicio earlier than now and no segments yet, start from that time.
        const hasSegments = segments.length > 0;
        const override = !hasSegments ? localTimeToTodayISO(view?.form_data?.hora_inicio) : undefined;
        await startTimerLocal(id, user.id, override);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const saveSignature = async (dataUrl: string) => {
    try {
      await saveEvaluationSignature(user.id, id, dataUrl);
      setWorkerSignaturePreview(dataUrl);
      toast.success("Assinatura registrada");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar assinatura"); }
  };

  const reopen = async () => {
    await updateEvaluation(id, { status: "paused", completed_at: null });
    toast.success("Avaliação reaberta para edição");
  };

  const finish = async () => {
    if (running) await pauseTimerLocal(id);
    if (!view.worker_signature_url) {
      if (!confirm("Nenhuma assinatura foi registrada. Finalizar mesmo assim?")) return;
    }
    const refreshed = await fetchSegmentsLocal(id);
    const t = deriveTimes(refreshed);
    const finalFormData = {
      ...view.form_data,
      hora_inicio: view.form_data.hora_inicio || getNowLocalTime(),
      intervalo_inicio: t.intervals.length ? toLocalTime(t.intervals[t.intervals.length - 1].from) : "",
      intervalo_fim: t.intervals.length ? toLocalTime(t.intervals[t.intervals.length - 1].to) : "",
      hora_fim: t.endedAt ? toLocalTime(t.endedAt) : view.form_data.hora_fim || getNowLocalTime(),
    };
    await updateEvaluation(id, {
      status: "completed",
      completed_at: new Date().toISOString(),
      form_data: finalFormData,
    });
    toast.success("Avaliação finalizada");
    router.navigate({ to: "/historico" });
  };

  const exportPdf = async () => {
    const [signatureDataUrl, technicianSignatureDataUrl, fieldSignatureDataUrl] = await Promise.all([
      resolveSignatureDataUrl(view.worker_signature_url),
      resolveResponsibleSignatureDataUrl(view.form_data.responsavel_tecnico_id, view.form_data.responsavel_tecnico),
      resolveResponsibleSignatureDataUrl(view.form_data.monitoramento_campo_id, view.form_data.monitoramento_campo),
    ]);
    await generateEvaluationPdf({
      type: view.type, worker: view.worker, company: view.company,
      completedAt: new Date().toISOString(), formData: view.form_data,
      signatureDataUrl, technicianSignatureDataUrl, fieldSignatureDataUrl,
    });
  };

  const remove = async () => {
    if (!confirm("Excluir esta avaliação?")) return;
    await deleteEvaluation(id);
    router.navigate({ to: "/" });
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-2">
        <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Button></Link>
        <Badge variant="outline" className={isChem ? "text-chemical" : "text-noise"}>
          <Icon className="mr-1 h-3 w-3" />{isChem ? "Agentes Químicos" : "Ruído"}
        </Badge>
        {view.status === "completed" && <Badge className="bg-success text-success-foreground">Concluída</Badge>}
        {view._pending && <Badge variant="outline" className="text-amber-700 border-amber-300">Pendente sync</Badge>}
      </div>

      <div className="sticky top-[60px] z-20 -mx-4 mb-6 border-b bg-background/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-6">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Decorrido</p>
              <p className="font-mono text-xl font-semibold tabular-nums">{formatDuration(elapsed)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Restante</p>
              <p className={`font-mono text-xl font-semibold tabular-nums ${remaining < 0 ? "text-destructive" : ""}`}>{formatRemaining(remaining)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {view.status !== "completed" && (
              <Button onClick={toggleTimer} variant={running ? "secondary" : "default"} size="sm">
                {running ? <><Pause className="mr-1.5 h-4 w-4" /> Pausar</> : <><Play className="mr-1.5 h-4 w-4" /> {elapsed > 0 ? "Retomar" : "Iniciar"}</>}
              </Button>
            )}
            <Button onClick={exportPdf} variant="outline" size="sm"><Download className="mr-1.5 h-4 w-4" /> PDF</Button>
            {view.status !== "completed" && (
              <Button onClick={finish} size="sm" className="bg-success hover:bg-success/90"><CheckCircle2 className="mr-1.5 h-4 w-4" /> Finalizar</Button>
            )}
            {view.status === "completed" && <Button onClick={reopen} size="sm" variant="secondary">Reabrir para edição</Button>}
          </div>
        </div>
        <Progress value={pct} className="mt-3 h-1.5" />
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-primary">Geral</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="company" className="text-xs font-medium">Empresa</Label>
              <Input id="company" value={view.company || ""} onChange={(e) => setTopField("company", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="worker" className="text-xs font-medium">Trabalhador</Label>
              <Input id="worker" value={view.worker || ""} onChange={(e) => setTopField("worker", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dur" className="text-xs font-medium">Tempo estimado (min)</Label>
              <Input id="dur" type="number" min={1} value={view.estimated_duration_minutes}
                onChange={(e) => setTopField("estimated_duration_minutes", Number(e.target.value))} />
            </div>
          </div>
        </div>

        {isChem
          ? <ChemicalForm data={view.form_data} onChange={updateField} />
          : <NoiseForm data={view.form_data} onChange={updateField} />}

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-primary">Assinatura do Trabalhador</h3>
          <SignaturePad existingUrl={workerSignaturePreview} onSave={saveSignature} />
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={remove} className="text-destructive">
            <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
          </Button>
          <p className="text-xs text-muted-foreground"><Save className="mr-1 inline h-3 w-3" />Salvamento automático ativo</p>
        </div>
      </div>
    </AppShell>
  );
}
