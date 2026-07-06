import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { supabase } from "../../lib/supabase";

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

export default function PlatformBillingPage() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc("admin_list_subscriptions");
      setRows((data as SubRow[]) ?? []);
    })();
  }, []);

  const filtered =
    filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Billing</h1>
      <p className="mt-1 text-sm text-smoke">All Stripe subscriptions synced to SyncMenu.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {["all", "active", "trialing", "past_due", "canceled"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${
              filter === s ? "bg-brand text-white" : "bg-mist text-smoke hover:bg-cloud"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="card mt-6 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-mist bg-cloud/50 text-smoke">
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
            {filtered.map((r) => (
              <tr key={r.restaurant_id} className="border-b border-mist last:border-0">
                <td className="px-4 py-3 font-medium">{r.restaurant_name}</td>
                <td className="px-4 py-3 text-smoke">{r.owner_email}</td>
                <td className="px-4 py-3 capitalize">{r.plan_id ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{r.status ?? "—"}</td>
                <td className="px-4 py-3">
                  {r.current_period_end
                    ? new Date(r.current_period_end).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {r.stripe_customer_id && (
                    <a
                      href={`https://dashboard.stripe.com/test/customers/${r.stripe_customer_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand hover:text-ember"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
