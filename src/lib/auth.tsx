import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getMeta, setMeta } from "@/lib/db/local";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let initialResolved = false;

    const persistSessionSnapshot = async (sess: Session | null) => {
      try {
        if (sess?.user) {
          await Promise.all([
            setMeta("auth:last-user-id", sess.user.id),
            setMeta("auth:last-user-email", sess.user.email ?? ""),
          ]);
        } else {
          await Promise.all([
            setMeta("auth:last-user-id", ""),
            setMeta("auth:last-user-email", ""),
          ]);
        }
      } catch (err) {
        console.warn("[auth] failed to persist local session snapshot", err);
      }
    };

    const restoreOfflineSession = async () => {
      try {
        const [userId, email] = await Promise.all([
          getMeta("auth:last-user-id"),
          getMeta("auth:last-user-email"),
        ]);
        if (!userId || cancelled) {
          if (!cancelled) {
            setSession(null);
          }
          return;
        }

        setSession({ user: { id: userId, email: email || undefined } as User } as Session);
      } catch (err) {
        console.warn("[auth] failed to restore offline session snapshot", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const applySession = async (sess: Session) => {
      if (cancelled) return;
      setSession(sess);
      await persistSessionSnapshot(sess);
      if (!cancelled) setLoading(false);
    };

    const handleMissingSession = async ({
      clearSnapshot = false,
    }: {
      clearSnapshot?: boolean;
    } = {}) => {
      if (cancelled) return;

      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (offline) {
        await restoreOfflineSession();
        return;
      }

      if (clearSnapshot) {
        await persistSessionSnapshot(null);
      }

      if (!cancelled) {
        setSession(null);
        setLoading(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (cancelled) return;

      if (event === "SIGNED_OUT") {
        void handleMissingSession({ clearSnapshot: true });
        return;
      }

      if (sess?.user) {
        void applySession(sess);
      } else if (initialResolved) {
        void handleMissingSession();
      } else {
        return;
      }

      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && sess?.user) {
        // Pull/push as soon as we have a session.
        void import("@/lib/sync/engine").then((m) => m.triggerSyncSoon(50));
      }
    });
    supabase.auth.getSession().then(async ({ data, error }) => {
      initialResolved = true;
      if (cancelled) return;

      if (data.session?.user) {
        await applySession(data.session);
        void import("@/lib/sync/engine").then((m) => m.triggerSyncSoon(200));
        return;
      }

      await handleMissingSession({ clearSnapshot: !error });
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setIsAdmin(false);
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsAdmin(false);
      return;
    }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [session?.user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // Limpa o cache local para o próximo usuário não enxergar dados alheios.
    try {
      const { clearLocalData } = await import("@/lib/db/local");
      await clearLocalData();
    } catch (err) {
      console.warn("[auth] clearLocalData failed", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, session, loading, isAdmin, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
