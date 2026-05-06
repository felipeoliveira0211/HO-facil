import { Link, useRouter } from "@tanstack/react-router";
import { Activity, LogOut, Plus, LayoutDashboard, FileText, Wrench, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { SyncBadge } from "@/components/SyncBadge";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { signOut, user, isAdmin } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  const navLink =
    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground";
  const activeCls = { className: "bg-secondary text-foreground" };

  return (
    <div className="min-h-screen bg-gradient-surface">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Activity className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <p className="font-display text-base font-bold tracking-tight">HO fácil</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Folha de campo
              </p>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link to="/" activeOptions={{ exact: true }} activeProps={activeCls} className={navLink}>
              <LayoutDashboard className="h-4 w-4" /> Painel
            </Link>
            <Link to="/historico" activeProps={activeCls} className={navLink}>
              <FileText className="h-4 w-4" /> Histórico
            </Link>
            <Link to="/equipamentos" activeProps={activeCls} className={navLink}>
              <Wrench className="h-4 w-4" /> Equipamentos
            </Link>
            <Link to="/responsaveis" activeProps={activeCls} className={navLink}>
              <Users className="h-4 w-4" /> Responsáveis
            </Link>
            {isAdmin && (
              <Link to="/admin" activeProps={activeCls} className={navLink}>
                <Shield className="h-4 w-4" /> Admin
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-2">
            <SyncBadge />
            <Link to="/nova">
              <Button size="sm" className="shadow-glow">
                <Plus className="mr-1 h-4 w-4" /> Nova
              </Button>
            </Link>
            <span className="hidden text-xs text-muted-foreground sm:inline">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-border/60 px-3 py-2 md:hidden">
          <Link to="/" activeOptions={{ exact: true }} activeProps={activeCls} className={navLink}>
            <LayoutDashboard className="h-4 w-4" /> Painel
          </Link>
          <Link to="/historico" activeProps={activeCls} className={navLink}>
            <FileText className="h-4 w-4" /> Histórico
          </Link>
          <Link to="/equipamentos" activeProps={activeCls} className={navLink}>
            <Wrench className="h-4 w-4" /> Equip.
          </Link>
          <Link to="/responsaveis" activeProps={activeCls} className={navLink}>
            <Users className="h-4 w-4" /> Resp.
          </Link>
          {isAdmin && (
            <Link to="/admin" activeProps={activeCls} className={navLink}>
              <Shield className="h-4 w-4" /> Admin
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
