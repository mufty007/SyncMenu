import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { AccountTransfer } from "../lib/types";

export default function TransferBanner() {
  const { restaurant, session, refreshRestaurant } = useAuth();
  const [transfer, setTransfer] = useState<AccountTransfer | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!restaurant) {
      setTransfer(null);
      return;
    }
    void supabase
      .from("account_transfers")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("status", "pending")
      .maybeSingle()
      .then(({ data }) => setTransfer((data as AccountTransfer) ?? null));
  }, [restaurant]);

  if (!transfer || !restaurant || !session) return null;

  const mine = transfer.requested_by === session.user.id;
  const label =
    transfer.direction === "to_restaurant"
      ? "full control to the restaurant"
      : "design control back to the studio";

  async function confirm() {
    setBusy(true);
    const { error } = await supabase.rpc("confirm_account_transfer", {
      p_restaurant_id: restaurant!.id,
    });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    setTransfer(null);
    await refreshRestaurant();
  }

  async function cancel() {
    setBusy(true);
    const { error } = await supabase.rpc("cancel_account_transfer", {
      p_restaurant_id: restaurant!.id,
    });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    setTransfer(null);
  }

  return (
    <div className="mb-6 rounded-xl border border-amber/30 bg-amber/10 p-4 text-sm">
      {mine ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            Waiting for the other party to confirm handing {label}.
          </p>
          <button className="btn-secondary" disabled={busy} onClick={() => void cancel()}>
            Cancel request
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            The other party requested handing {label}. Subscription stays as-is.
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={busy} onClick={() => void cancel()}>
              Decline
            </button>
            <button className="btn-primary" disabled={busy} onClick={() => void confirm()}>
              Confirm transfer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
