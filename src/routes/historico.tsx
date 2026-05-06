import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlaskConical, Volume2, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateEvaluationPdf } from "@/lib/pdf";
import { useEvaluations } from "@/lib/repo/evaluations";
import { resolveSignatureDataUrl, resolveResponsibleSignatureDataUrl } from "@/lib/repo/signatures";

export const Route = createFileRoute("/historico")({ component: HistoryPage });

function HistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const items = useEvaluations({ userId: user?.id, onlyCompleted: true });

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const exportPdf = async (item: (typeof items)[number]) => {
    const f = item.form_data;
    const [signatureDataUrl, technicianSignatureDataUrl, fieldSignatureDataUrl] = await Promise.all([
      resolveSignatureDataUrl(item.worker_signature_url),
      resolveResponsibleSignatureDataUrl(f.responsavel_tecnico_id, f.responsavel_tecnico),
      resolveResponsibleSignatureDataUrl(f.monitoramento_campo_id, f.monitoramento_campo),
    ]);
    await generateEvaluationPdf({
      type: item.type,
      worker: item.worker,
      company: item.company,
      completedAt: item.completed_at,
      formData: item.form_data,
      signatureDataUrl,
      technicianSignatureDataUrl,
      fieldSignatureDataUrl,
    });
  };

  if (loading || !user) return null;

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Histórico</h1>
      <p className="mt-1 text-sm text-muted-foreground">Avaliações finalizadas.</p>

      <div className="mt-6 space-y-2">
        {items.length === 0 ? (
          <p className="rounded-xl border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            Nenhuma avaliação finalizada ainda.
          </p>
        ) : (
          items.map((it) => {
            const isChem = it.type === "chemical";
            const Icon = isChem ? FlaskConical : Volume2;
            return (
              <div key={it.id} className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-card">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isChem ? "bg-gradient-chemical" : "bg-gradient-noise"}`}>
                  <Icon className="h-5 w-5 text-white" strokeWidth={2.4} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{it.worker || "Sem nome"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {it.company} • {it.completed_at && format(new Date(it.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
                {it._pending ? <Badge variant="outline" className="text-amber-700 border-amber-300">Pendente</Badge> : null}
                <Badge variant="outline">{isChem ? "Químico" : "Ruído"}</Badge>
                <Button size="sm" variant="outline" onClick={() => exportPdf(it)}>
                  <Download className="mr-1.5 h-4 w-4" /> PDF
                </Button>
                <Link to="/avaliacao/$id" params={{ id: it.id }}><Button size="sm">Editar</Button></Link>
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
