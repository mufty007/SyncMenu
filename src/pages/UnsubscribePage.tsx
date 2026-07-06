import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Logo from "../components/Logo";
import { supabase } from "../lib/supabase";

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      return;
    }
    void (async () => {
      const { error } = await supabase.functions.invoke("unsubscribe", {
        body: { token },
      });
      setStatus(error ? "error" : "ok");
    })();
  }, [params]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-md p-8 text-center">
        <Logo size={32} />
        {status === "loading" && <p className="mt-6 text-sm text-smoke">Processing…</p>}
        {status === "ok" && (
          <>
            <h1 className="mt-6 text-xl font-semibold">You're unsubscribed</h1>
            <p className="mt-2 text-sm text-smoke">
              You won't receive platform announcements from SyncMenu anymore. You'll still get
              account emails like password resets.
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="mt-6 text-xl font-semibold">Link invalid</h1>
            <p className="mt-2 text-sm text-smoke">
              This unsubscribe link may have expired. Contact support@syncmenu.app if you need help.
            </p>
          </>
        )}
        <Link to="/" className="btn-secondary mt-6 inline-flex">
          Back to SyncMenu
        </Link>
      </div>
    </div>
  );
}
