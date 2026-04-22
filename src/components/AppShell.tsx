import { Link, useRouter } from "@tanstack/react-router";
import { Activity, LogOut, Plus, LayoutDashboard, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Activity className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <p className="font-display text-base font-bold tracking-tight">HigieneOK</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Higiene Ocupacional
              </p>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              activeProps={{ className: "bg-secondary text-foreground" }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
            >
              <LayoutDashboard className="h-4 w-4" /> Painel
            </Link>
            <Link
              to="/historico"
              activeProps={{ className: "bg-secondary text-foreground" }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
            >
              <FileText className="h-4 w-4" /> Histórico
            </Link>
          </nav>
          <div className="flex items-center gap-2">
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
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
