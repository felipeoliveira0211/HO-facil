import { Cloud, CloudOff, RefreshCw, Check } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { runSync } from "@/lib/sync/engine";

export function SyncBadge() {
  const online = useOnlineStatus();
  const { pending, syncing } = useSyncStatus();

  let label: string;
  let Icon = Check;
  let cls = "bg-success/15 text-success border-success/30";
  let title = "Tudo sincronizado com o servidor";

  if (!online) {
    label = pending > 0 ? `Offline · ${pending}` : "Offline";
    Icon = CloudOff;
    cls = "bg-destructive/10 text-destructive border-destructive/30";
    title = pending
      ? `Sem conexão · ${pending} alteração(ões) aguardando envio`
      : "Sem conexão · alterações ficam salvas no aparelho";
  } else if (syncing || pending > 0) {
    label = pending > 0 ? `Sincronizando · ${pending}` : "Sincronizando";
    Icon = RefreshCw;
    cls = "bg-amber-100 text-amber-800 border-amber-300";
    title = `Enviando alterações pendentes (${pending})`;
  } else {
    label = "Online";
    Icon = Cloud;
  }

  return (
    <button
      type="button"
      onClick={() => void runSync()}
      title={title + " · clique para forçar sincronização"}
      className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition sm:inline-flex ${cls}`}
    >
      <Icon className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
      <span>{label}</span>
    </button>
  );
}
