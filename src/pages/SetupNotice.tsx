import Logo from "../components/Logo";

export default function SetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-xl p-8">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold">
          Almost there — connect Supabase
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-smoke">
          SyncMenu needs a Supabase project for auth, data, realtime sync and
          image storage. One-time setup:
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-smoke">
          <li>
            Create a free project at{" "}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand hover:text-ember"
            >
              supabase.com
            </a>
          </li>
          <li>
            In the SQL editor, run{" "}
            <code className="rounded bg-cloud px-1.5 py-0.5 text-ink">
              supabase/migrations/0001_init.sql
            </code>
          </li>
          <li>
            Copy <code className="rounded bg-cloud px-1.5 py-0.5 text-ink">.env.example</code>{" "}
            to <code className="rounded bg-cloud px-1.5 py-0.5 text-ink">.env</code> and fill
            in your project URL and anon key
          </li>
          <li>Restart the dev server</li>
        </ol>
      </div>
    </div>
  );
}
