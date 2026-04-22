import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlaskConical, Volume2, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateEvaluationPdf } from "@/lib/pdf";

export const Route = createFileRoute("/historico")({
  component: HistoryPage,
});

interface Item {
  id: string;
  type: "chemical" | "noise";
  worker: string | null;
  company: string | null;
  completed_at: string | null;
  form_data: Record<string, unknown>;
  estimated_duration_minutes: number;
  worker_signature_url: string | null;
}

function HistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("evaluations")
      .select(
        "id, type, worker, company, completed_at, form_data, estimated_duration_minutes, worker_signature_url",
      )
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .then(({ data }) => setItems((data ?? []) as Item[]));
  }, [user]);

  const exportPdf = async (item: Item) => {
    let signatureDataUrl: string | undefined;
    if (item.worker_signature_url) {
      const { data } = await supabase.storage
        .from("signatures")
        .createSignedUrl(item.worker_signature_url, 60);
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
      type: item.type,
      worker: item.worker,
      company: item.company,
      completedAt: item.completed_at,
      formData: item.form_data,
      signatureDataUrl,
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
              <div
                key={it.id}
                className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-card"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${isChem ? "bg-gradient-chemical" : "bg-gradient-noise"}`}
                >
                  <Icon className="h-5 w-5 text-white" strokeWidth={2.4} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{it.worker || "Sem nome"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {it.company} •{" "}
                    {it.completed_at &&
                      format(new Date(it.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Badge variant="outline">{isChem ? "Químico" : "Ruído"}</Badge>
                <Button size="sm" variant="outline" onClick={() => exportPdf(it)}>
                  <Download className="mr-1.5 h-4 w-4" /> PDF
                </Button>
                <Link to="/avaliacao/$id" params={{ id: it.id }}>
                  <Button size="sm" variant="ghost">
                    Ver
                  </Button>
                </Link>
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
