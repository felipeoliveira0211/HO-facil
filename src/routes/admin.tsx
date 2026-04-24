import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlaskConical, Volume2, Download, Shield, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateEvaluationPdf } from "@/lib/pdf";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

interface Item {
  id: string;
  user_id: string;
  type: "chemical" | "noise";
  status: string;
  worker: string | null;
  company: string | null;
  completed_at: string | null;
  created_at: string;
  form_data: Record<string, unknown>;
  worker_signature_url: string | null;
}

function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "open">("all");

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
    if (!loading && user && !isAdmin) router.navigate({ to: "/" });
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("evaluations")
      .select(
        "id, user_id, type, status, worker, company, completed_at, created_at, form_data, worker_signature_url",
      )
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems((data ?? []) as Item[]));
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (statusFilter === "completed" && it.status !== "completed") return false;
      if (statusFilter === "open" && it.status === "completed") return false;
      if (!q) return true;
      return (
        (it.worker || "").toLowerCase().includes(q) ||
        (it.company || "").toLowerCase().includes(q) ||
        ((it.form_data as Record<string, string>)?.setor || "").toLowerCase().includes(q)
      );
    });
  }, [items, query, statusFilter]);

  const exportPdf = async (item: Item) => {
    const { fetchSignatureDataUrl, fetchResponsibleSignature } = await import("@/lib/signatures");
    const f = item.form_data as Record<string, string>;
    const [signatureDataUrl, technicianSignatureDataUrl, fieldSignatureDataUrl] = await Promise.all([
      item.worker_signature_url
        ? fetchSignatureDataUrl(item.worker_signature_url)
        : Promise.resolve(undefined),
      fetchResponsibleSignature(f.responsavel_tecnico_id, f.responsavel_tecnico),
      fetchResponsibleSignature(f.monitoramento_campo_id, f.monitoramento_campo),
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

  if (loading || !user || !isAdmin) return null;

  const total = items.length;
  const completed = items.filter((i) => i.status === "completed").length;
  const inProgress = total - completed;

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="font-display text-3xl font-bold tracking-tight">Painel do Administrador</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Visualize todas as avaliações cadastradas no sistema.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">{total}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Finalizadas</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-success">{completed}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Em andamento</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">{inProgress}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por trabalhador, empresa ou setor..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {(["all", "completed", "open"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {s === "all" ? "Todas" : s === "completed" ? "Finalizadas" : "Em aberto"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {filtered.length === 0 ? (
          <p className="rounded-xl border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            Nenhuma avaliação encontrada.
          </p>
        ) : (
          filtered.map((it) => {
            const isChem = it.type === "chemical";
            const Icon = isChem ? FlaskConical : Volume2;
            const f = it.form_data as Record<string, string>;
            return (
              <div
                key={it.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-card sm:flex-nowrap"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isChem ? "bg-gradient-chemical" : "bg-gradient-noise"}`}
                >
                  <Icon className="h-5 w-5 text-white" strokeWidth={2.4} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{it.worker || "Sem nome"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[it.company, f?.setor].filter(Boolean).join(" / ")}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    Usuário: {it.user_id.slice(0, 8)}… •{" "}
                    {format(new Date(it.completed_at || it.created_at), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <Badge variant="outline">{isChem ? "Químico" : "Ruído"}</Badge>
                <Badge
                  className={
                    it.status === "completed"
                      ? "bg-success text-success-foreground"
                      : "bg-muted text-foreground"
                  }
                >
                  {it.status === "completed" ? "Finalizada" : "Em aberto"}
                </Badge>
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