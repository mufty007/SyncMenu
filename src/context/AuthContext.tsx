import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type {
  AccountType,
  Restaurant,
  RestaurantRole,
  Studio,
} from "../lib/types";

const ACTIVE_RESTAURANT_KEY = "syncmenu.activeRestaurantId";

interface AuthState {
  session: Session | null;
  restaurant: Restaurant | null;
  restaurants: Restaurant[];
  role: RestaurantRole | null;
  accountType: AccountType | null;
  studio: Studio | null;
  isDesigner: boolean;
  canDesign: boolean;
  canPay: boolean;
  isOperator: boolean;
  isPlatformAdmin: boolean;
  loading: boolean;
  setActiveRestaurantId: (id: string) => void;
  refreshRestaurant: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  restaurant: null,
  restaurants: [],
  role: null,
  accountType: null,
  studio: null,
  isDesigner: false,
  canDesign: false,
  canPay: false,
  isOperator: false,
  isPlatformAdmin: false,
  loading: true,
  setActiveRestaurantId: () => {},
  refreshRestaurant: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [rolesByRestaurant, setRolesByRestaurant] = useState<Record<string, RestaurantRole>>(
    {}
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadWorkspace = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setRestaurants([]);
      setRolesByRestaurant({});
      setActiveId(null);
      setAccountType(null);
      setStudio(null);
      setIsPlatformAdmin(false);
      return;
    }

    const [{ data: profile }, { data: studioRow }, { data: admin }, { data: memberRows }] =
      await Promise.all([
        supabase.from("profiles").select("account_type").eq("user_id", userId).maybeSingle(),
        supabase.from("studios").select("*").eq("owner_user_id", userId).maybeSingle(),
        supabase.rpc("is_platform_admin"),
        supabase
          .from("restaurant_members")
          .select("restaurant_id, role, accepted_at")
          .eq("user_id", userId),
      ]);

    const accepted = (memberRows ?? []).filter(
      (m: { accepted_at: string | null }) => m.accepted_at
    ) as { restaurant_id: string; role: RestaurantRole; accepted_at: string }[];

    const roleMap: Record<string, RestaurantRole> = {};
    for (const m of accepted) roleMap[m.restaurant_id] = m.role;

    let restaurantRows: Restaurant[] = [];
    if (accepted.length) {
      const { data } = await supabase
        .from("restaurants")
        .select("*")
        .in(
          "id",
          accepted.map((m) => m.restaurant_id)
        );
      restaurantRows = (data as Restaurant[]) ?? [];
    }

    const stored = localStorage.getItem(ACTIVE_RESTAURANT_KEY);
    const nextId =
      (stored && restaurantRows.some((r) => r.id === stored) && stored) ||
      restaurantRows[0]?.id ||
      null;

    setAccountType(
      studioRow
        ? "designer"
        : ((profile?.account_type as AccountType | undefined) ?? "restaurant")
    );
    setStudio((studioRow as Studio) ?? null);
    setIsPlatformAdmin(Boolean(admin));
    setRestaurants(restaurantRows);
    setRolesByRestaurant(roleMap);
    setActiveId(nextId);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadWorkspace(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      await loadWorkspace(newSession?.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadWorkspace]);

  const restaurant = useMemo(
    () => restaurants.find((r) => r.id === activeId) ?? null,
    [restaurants, activeId]
  );
  const role = restaurant ? (rolesByRestaurant[restaurant.id] ?? null) : null;
  const isDesigner = accountType === "designer" || !!studio;
  const canDesign = role === "owner" || role === "designer";
  const canPay = role === "owner" || role === "operator";
  const isOperator = role === "operator";

  const setActiveRestaurantId = useCallback((id: string) => {
    localStorage.setItem(ACTIVE_RESTAURANT_KEY, id);
    setActiveId(id);
  }, []);

  const refreshRestaurant = useCallback(
    () => loadWorkspace(session?.user.id),
    [loadWorkspace, session]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        restaurant,
        restaurants,
        role,
        accountType,
        studio,
        isDesigner,
        canDesign,
        canPay,
        isOperator,
        isPlatformAdmin,
        loading,
        setActiveRestaurantId,
        refreshRestaurant,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
