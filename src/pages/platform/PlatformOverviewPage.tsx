import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Stats {
  total_restaurants: number;
  active_trials: number;
  subscribed: number;
  signups_7d: number;
  total_screens: number;
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

  if (error) return <p className="text-sm text-alert">{error}</p>;
  if (!stats) return <p className="text-sm text-smoke">Loading…</p>;

  const cards = [
    { label: "Restaurants", value: stats.total_restaurants },
    { label: "Active trials", value: stats.active_trials },
    { label: "Subscribed", value: stats.subscribed },
    { label: "Signups (7d)", value: stats.signups_7d },
    { label: "Screens", value: stats.total_screens },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold">Platform overview</h1>
      <p className="mt-1 text-sm text-smoke">SyncMenu at a glance.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-6">
            <p className="text-sm text-smoke">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
