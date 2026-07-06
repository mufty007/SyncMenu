import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { Restaurant } from "../lib/types";

interface AuthState {
  session: Session | null;
  restaurant: Restaurant | null;
  isPlatformAdmin: boolean;
  loading: boolean;
  refreshRestaurant: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  restaurant: null,
  isPlatformAdmin: false,
  loading: true,
  refreshRestaurant: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRestaurant = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setRestaurant(null);
      setIsPlatformAdmin(false);
      return;
    }
    const [{ data }, { data: admin }] = await Promise.all([
      supabase.from("restaurants").select("*").eq("owner_id", userId).maybeSingle(),
      supabase.rpc("is_platform_admin"),
    ]);
    setRestaurant((data as Restaurant) ?? null);
    setIsPlatformAdmin(Boolean(admin));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadRestaurant(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        await loadRestaurant(newSession?.user.id);
        setLoading(false);
      }
    );
    return () => sub.subscription.unsubscribe();
  }, [loadRestaurant]);

  const refreshRestaurant = useCallback(
    () => loadRestaurant(session?.user.id),
    [loadRestaurant, session]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, restaurant, isPlatformAdmin, loading, refreshRestaurant, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
