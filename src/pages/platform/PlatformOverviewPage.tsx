import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  CreditCard,
  MonitorPlay,
  Palette,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { PageHeader, StatCard } from "./ui";

interface Stats {
  total_restaurants: number;
  active_trials: number;
  subscribed: number;
  signups_7d: number;
  total_screens: number;
  total_studios?: number;
  partner_restaurants?: number;
  partner_subscribed?: number;
}

function StatSkeleton() {
  return (
    <div className="card p-5">
      <div className="h-4 w-24 animate-pulse rounded bg-mist" />
      <div className="mt-4 h-8 w-16 animate-pulse rounded bg-mist" />
    </div>
  );
}

export default function PlatformOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error: err } = await supabase.rpc("admin_platform_stats");
      if (err) setError(err.message);
      else setStats(data as Stats);
    })();
  }, []);

  const conversion =
    stats && stats.total_restaurants > 0
      ? Math.round((stats.subscribed / stats.total_restaurants) * 100)
      : 0;

  return (
    <div>
      <PageHeader title="Platform overview" subtitle="SyncMenu at a glance." />

      {error ? (
        <div className="card mt-8 border-alert/30 bg-alert/5 p-5 text-sm text-alert">
          {error}
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {!stats ? (
              Array.from({ length: 7 }).map((_, i) => <StatSkeleton key={i} />)
            ) : (
              <>
                <StatCard
                  icon={Building2}
                  label="Restaurants"
                  value={stats.total_restaurants}
                  accent
                />
                <StatCard
                  icon={Sparkles}
                  label="Active trials"
                  value={stats.active_trials}
                  hint="Not yet subscribed"
                />
                <StatCard
                  icon={CreditCard}
                  label="Subscribed"
                  value={stats.subscribed}
                  hint={`${conversion}% of all restaurants`}
                />
                <StatCard
                  icon={TrendingUp}
                  label="New signups"
                  value={stats.signups_7d}
                  hint="Last 7 days"
                />
                <StatCard
                  icon={MonitorPlay}
                  label="Screens paired"
                  value={stats.total_screens}
                />
                <StatCard
                  icon={Palette}
                  label="Designer studios"
                  value={stats.total_studios ?? 0}
                  hint={`${stats.partner_restaurants ?? 0} partner restaurants`}
                />
                <StatCard
                  icon={CreditCard}
                  label="Partner subscribed"
                  value={stats.partner_subscribed ?? 0}
                  hint="Paying shops brought in by studios"
                />
              </>
            )}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              to="/platform/tenants"
              className="card flex items-center justify-between p-5 transition-shadow hover:shadow-md"
            >
              <div>
                <p className="font-medium">Manage restaurants</p>
                <p className="mt-0.5 text-sm text-smoke">
                  Search accounts, extend trials, suspend abuse.
                </p>
              </div>
              <Building2 size={20} className="text-brand" />
            </Link>
            <Link
              to="/platform/studios"
              className="card flex items-center justify-between p-5 transition-shadow hover:shadow-md"
            >
              <div>
                <p className="font-medium">Manage designers</p>
                <p className="mt-0.5 text-sm text-smoke">
                  Studio usage, restaurant counts, and partner billing.
                </p>
              </div>
              <Palette size={20} className="text-brand" />
            </Link>
            <Link
              to="/platform/billing"
              className="card flex items-center justify-between p-5 transition-shadow hover:shadow-md"
            >
              <div>
                <p className="font-medium">Review billing</p>
                <p className="mt-0.5 text-sm text-smoke">
                  All Stripe subscriptions in one place.
                </p>
              </div>
              <CreditCard size={20} className="text-brand" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
