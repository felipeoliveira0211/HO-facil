import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Play,
  Pause,
  Save,
  CheckCircle2,
  FlaskConical,
  Volume2,
  Download,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  computeElapsedSeconds,
  fetchSegments,
  isRunning,
  pauseTimer,
  startTimer,
  type TimeSegment,
} from "@/lib/timer";
import { formatDuration, formatRemaining } from "@/lib/format";
import { ChemicalForm } from "@/components/ChemicalForm";
import { NoiseForm } from "@/components/NoiseForm";
import { SignaturePad } from "@/components/SignaturePad";
import { generateEvaluationPdf } from "@/lib/pdf";

export const Route = createFileRoute("/avaliacao/$id")({
  component: EvaluationPage,
});

interface Evaluation {
  id: string;
  type: "chemical" | "noise";
  status: "draft" | "in_progress" | "paused" | "completed";
  company: string | null;
  worker: string | null;
  estimated_duration_minutes: number;
  form_data: Record<string, string>;
  worker_signature_url: string | null;
}

function EvaluationPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [segments, setSegments] = useState<TimeSegment[]>([]);
  const [, tick] = useState(0);
  const saveTimer = useRef<number | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("evaluations")
      .select(
        "id, type, status, company, worker, estimated_duration_minutes, form_data, worker_signature_url",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      toast.error("Avaliação não encontrada");
      router.navigate({ to: "/" });
      return;
    }
    setEvaluation({
      ...data,
      form_data: (data.form_data as Record<string, string>) || {},
    });
    setSegments(await fetchSegments(id));
  }, [id, router]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const running = isRunning(segments);

  useEffect(() => {
    if (!running) return;
    const i = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(i);
  }, [running]);

  // Debounced autosave
  const scheduleSave = useCallback(() => {
    dirty.current = true;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      if (!evaluation || !dirty.current) return;
      dirty.current = false;
      await supabase
        .from("evaluations")
        .update({
          form_data: evaluation.form_data,
          company: evaluation.company,
          worker: evaluation.worker,
          estimated_duration_minutes: evaluation.estimated_duration_minutes,
        })
        .eq("id", evaluation.id);
    }, 800);
  }, [evaluation]);

  useEffect(() => {
    if (evaluation) scheduleSave();
  }, [evaluation, scheduleSave]);

  if (loading || !user || !evaluation) {
    return (
      <AppShell>
        <div className="h-96 animate-pulse rounded-2xl bg-muted/60" />
      </AppShell>
    );
  }

  const isChem = evaluation.type === "chemical";
  const Icon = isChem ? FlaskConical : Volume2;
  const elapsed = computeElapsedSeconds(segments);
  const total = evaluation.estimated_duration_minutes * 60;
  const remaining = total - elapsed;
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));

  const updateField = (key: string, value: string) => {
    setEvaluation({
      ...evaluation,
      form_data: { ...evaluation.form_data, [key]: value },
    });
  };

  const toggleTimer = async () => {
    try {
      if (running) {
        await pauseTimer(evaluation.id);
      } else {
        await startTimer(evaluation.id, user.id);
      }
      setSegments(await fetchSegments(evaluation.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const saveSignature = async (dataUrl: string) => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${user.id}/${evaluation.id}.png`;
      const { error: upErr } = await supabase.storage
        .from("signatures")
        .upload(path, blob, { upsert: true, contentType: "image/png" });
      if (upErr) {
        toast.error(`Falha no upload: ${upErr.message}`);
        return;
      }
      const { error: dbErr } = await supabase
        .from("evaluations")
        .update({ worker_signature_url: path })
        .eq("id", evaluation.id);
      if (dbErr) {
        toast.error(`Falha ao salvar: ${dbErr.message}`);
        return;
      }
      setEvaluation({ ...evaluation, worker_signature_url: path });
      toast.success("Assinatura registrada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado ao salvar assinatura");
    }
  };

  const reopen = async () => {
    await supabase
      .from("evaluations")
      .update({ status: "paused", completed_at: null })
      .eq("id", evaluation.id);
    toast.success("Avaliação reaberta para edição");
    load();
  };

  const finish = async () => {
    if (running) await pauseTimer(evaluation.id);
    if (!evaluation.worker_signature_url) {
      if (!confirm("Nenhuma assinatura foi registrada. Finalizar mesmo assim?")) return;
    }
    await supabase
      .from("evaluations")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        form_data: evaluation.form_data,
      })
      .eq("id", evaluation.id);
    toast.success("Avaliação finalizada");
    router.navigate({ to: "/historico" });
  };

  const exportPdf = async () => {
    let signatureDataUrl: string | undefined;
    if (evaluation.worker_signature_url) {
      const { data } = await supabase.storage
        .from("signatures")
        .createSignedUrl(evaluation.worker_signature_url, 60);
      if (data?.signedUrl) {
        const res = await fetch(data.signedUrl);
        const blob = await res.blob();
        signatureDataUrl = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onloadend = () => resolve(r.result as string);
          r.readAsDataURL(blob);
        });
      }
    }
    generateEvaluationPdf({
      type: evaluation.type,
      worker: evaluation.worker,
      company: evaluation.company,
      completedAt: new Date().toISOString(),
      formData: evaluation.form_data,
      signatureDataUrl,
    });
  };

  const remove = async () => {
    if (!confirm("Excluir esta avaliação?")) return;
    await supabase.from("evaluations").delete().eq("id", evaluation.id);
    router.navigate({ to: "/" });
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-2">
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
        </Link>
        <Badge variant="outline" className={isChem ? "text-chemical" : "text-noise"}>
          <Icon className="mr-1 h-3 w-3" />
          {isChem ? "Agentes Químicos" : "Ruído"}
        </Badge>
        {evaluation.status === "completed" && (
          <Badge className="bg-success text-success-foreground">Concluída</Badge>
        )}
      </div>

      {/* Sticky timer header */}
      <div className="sticky top-[60px] z-20 -mx-4 mb-6 border-b bg-background/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-6">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Decorrido
              </p>
              <p className="font-mono text-xl font-semibold tabular-nums">
                {formatDuration(elapsed)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Restante
              </p>
              <p
                className={`font-mono text-xl font-semibold tabular-nums ${remaining < 0 ? "text-destructive" : ""}`}
              >
                {formatRemaining(remaining)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {evaluation.status !== "completed" && (
              <Button onClick={toggleTimer} variant={running ? "secondary" : "default"} size="sm">
                {running ? (
                  <>
                    <Pause className="mr-1.5 h-4 w-4" /> Pausar
                  </>
                ) : (
                  <>
                    <Play className="mr-1.5 h-4 w-4" /> {elapsed > 0 ? "Retomar" : "Iniciar"}
                  </>
                )}
              </Button>
            )}
            <Button onClick={exportPdf} variant="outline" size="sm">
              <Download className="mr-1.5 h-4 w-4" /> PDF
            </Button>
            {evaluation.status !== "completed" && (
              <Button onClick={finish} size="sm" className="bg-success hover:bg-success/90">
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Finalizar
              </Button>
            )}
          </div>
        </div>
        <Progress value={pct} className="mt-3 h-1.5" />
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-primary">
            Geral
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="company" className="text-xs font-medium">
                Empresa
              </Label>
              <Input
                id="company"
                value={evaluation.company || ""}
                onChange={(e) => setEvaluation({ ...evaluation, company: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="worker" className="text-xs font-medium">
                Trabalhador
              </Label>
              <Input
                id="worker"
                value={evaluation.worker || ""}
                onChange={(e) => setEvaluation({ ...evaluation, worker: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dur" className="text-xs font-medium">
                Tempo estimado (min)
              </Label>
              <Input
                id="dur"
                type="number"
                min={1}
                value={evaluation.estimated_duration_minutes}
                onChange={(e) =>
                  setEvaluation({
                    ...evaluation,
                    estimated_duration_minutes: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        </div>

        {isChem ? (
          <ChemicalForm data={evaluation.form_data} onChange={updateField} />
        ) : (
          <NoiseForm data={evaluation.form_data} onChange={updateField} />
        )}

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-primary">
            Assinatura do Trabalhador
          </h3>
          <SignaturePad onSave={saveSignature} />
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={remove} className="text-destructive">
            <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
          </Button>
          <p className="text-xs text-muted-foreground">
            <Save className="mr-1 inline h-3 w-3" />
            Salvamento automático ativo
          </p>
        </div>
      </div>
    </AppShell>
  );
}
