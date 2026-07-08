import { useEffect, useState } from "react";
import { CreditCard, ExternalLink } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { stripeCustomerUrl } from "../../lib/stripeLinks";
import { EmptyState, PageHeader, StatusBadge } from "./ui";

interface SubRow {
  restaurant_id: string;
  restaurant_name: string;
  owner_email: string;
  plan_id: string | null;
  status: string | null;
  stripe_customer_id: string | null;
  current_period_end: string | null;
  updated_at: string;
}

const FILTERS = ["all", "active", "trialing", "past_due", "canceled"];

export default function PlatformBillingPage() {
  const [rows, setRows] = useState<SubRow[] | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc("admin_list_subscriptions");
      setRows((data as SubRow[]) ?? []);
    })();
  }, []);

  const all = rows ?? [];
  const filtered = filter === "all" ? all : all.filter((r) => r.status === filter);

  function count(status: string) {
    if (status === "all") return all.length;
    return all.filter((r) => r.status === status).length;
  }

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle="All Stripe subscriptions synced to SyncMenu."
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors ${
              filter === s ? "bg-brand text-white" : "bg-mist/60 text-smoke hover:bg-mist"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
            {rows && (
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${
                  filter === s ? "bg-white/20" : "bg-white/70"
                }`}
              >
                {count(s)}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-mist bg-cloud/50 text-xs uppercase tracking-wide text-smoke">
              <tr>
                <th className="px-4 py-3 font-medium">Restaurant</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Period end</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-mist last:border-0">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-5 w-full animate-pulse rounded bg-mist/60" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={CreditCard}
                      title="No subscriptions"
                      hint={
                        filter === "all"
                          ? "Paid subscriptions appear here once owners check out."
                          : `No ${filter.replace("_", " ")} subscriptions right now.`
                      }
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.restaurant_id}
                    className="border-b border-mist transition-colors last:border-0 hover:bg-cloud/40"
                  >
                    <td className="px-4 py-3 font-medium">{r.restaurant_name}</td>
                    <td className="px-4 py-3 text-smoke">{r.owner_email}</td>
                    <td className="px-4 py-3 capitalize">{r.plan_id ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-smoke">
                      {r.current_period_end
                        ? new Date(r.current_period_end).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.stripe_customer_id && (
                        <a
                          href={stripeCustomerUrl(r.stripe_customer_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-brand hover:text-ember"
                          title="Open in Stripe"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
