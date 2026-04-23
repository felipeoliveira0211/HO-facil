import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, Pause, ChevronRight, FlaskConical, Volume2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { computeElapsedSeconds, isRunning, pauseTimer, startTimer } from "@/lib/timer";
import type { TimeSegment } from "@/lib/timer";
import { formatDuration, formatRemaining } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface EvaluationCardData {
  id: string;
  type: "chemical" | "noise";
  status: "draft" | "in_progress" | "paused" | "completed";
  title: string | null;
  company: string | null;
  worker: string | null;
  estimated_duration_minutes: number;
  form_data?: Record<string, string>;
  segments: TimeSegment[];
}

export function EvaluationCard({
  evaluation,
  onChange,
}: {
  evaluation: EvaluationCardData;
  onChange: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [, tick] = useState(0);
  const running = isRunning(evaluation.segments);

  useEffect(() => {
    if (!running) return;
    const i = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(i);
  }, [running]);

  const elapsed = computeElapsedSeconds(evaluation.segments);
  const total = evaluation.estimated_duration_minutes * 60;
  const remaining = total - elapsed;
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));

  const isChem = evaluation.type === "chemical";
  const accentBg = isChem ? "bg-gradient-chemical" : "bg-gradient-noise";
  const accentText = isChem ? "text-chemical" : "text-noise";
  const Icon = isChem ? FlaskConical : Volume2;

  const toggle = async () => {
    if (!user) return;
    try {
      if (running) {
        await pauseTimer(evaluation.id);
        toast.success("Cronômetro pausado");
      } else {
        await startTimer(evaluation.id, user.id);
        toast.success("Cronômetro iniciado");
      }
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const open = () => router.navigate({ to: "/avaliacao/$id", params: { id: evaluation.id } });

  const finish = async () => {
    if (running) await pauseTimer(evaluation.id);
    await supabase
      .from("evaluations")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", evaluation.id);
    toast.success("Avaliação finalizada");
    onChange();
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card shadow-card transition hover:shadow-elevated">
      <div className={`h-1.5 ${accentBg}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentBg} shadow-glow`}
            >
              <Icon className="h-5 w-5 text-white" strokeWidth={2.4} />
            </div>
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${accentText}`}>
                {isChem ? "Agentes Químicos" : "Ruído"}
              </p>
              <h3 className="font-display text-base font-semibold leading-tight">
                {evaluation.worker || evaluation.title || "Sem identificação"}
              </h3>
              {evaluation.company && (
                <p className="text-xs text-muted-foreground">{evaluation.company}</p>
              )}
              {(() => {
                const fd = evaluation.form_data || {};
                const equipLabel = [fd.equip_marca, fd.equipamento]
                  .filter((s) => s && String(s).trim())
                  .join(" ");
                const serial = fd.equip_serie ? ` • S/N ${fd.equip_serie}` : "";
                if (!equipLabel && !serial) return null;
                return (
                  <p className="text-xs text-muted-foreground">
                    🔧 {equipLabel}
                    {serial}
                  </p>
                );
              })()}
            </div>
          </div>
          <Badge
            variant={running ? "default" : evaluation.status === "paused" ? "secondary" : "outline"}
            className={running ? "bg-success text-success-foreground timer-running" : ""}
          >
            {running ? "Rodando" : evaluation.status === "paused" ? "Pausada" : "Aguardando"}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-secondary/60 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Decorrido
            </p>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {formatDuration(elapsed)}
            </p>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Restante
            </p>
            <p
              className={`font-mono text-lg font-semibold tabular-nums ${remaining < 0 ? "text-destructive" : ""}`}
            >
              {formatRemaining(remaining)}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Estimativa: {evaluation.estimated_duration_minutes} min
            </span>
            <span className="font-medium tabular-nums">{pct.toFixed(0)}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            variant={running ? "secondary" : "default"}
            size="sm"
            onClick={toggle}
            className="flex-1"
          >
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
          <Button variant="outline" size="sm" onClick={open} className="flex-1">
            Abrir <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={finish} title="Finalizar">
            ✓
          </Button>
        </div>
      </div>
    </div>
  );
}
