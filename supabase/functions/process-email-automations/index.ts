import { corsHeaders, json } from "../_shared/stripe.ts";
import {
  processAutomationQueue,
  processTrialAutomations,
} from "../_shared/automation.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("AUTOMATION_CRON_SECRET");
  const headerSecret = req.headers.get("X-Cron-Secret");
  if (!cronSecret || headerSecret !== cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const queueSent = await processAutomationQueue();
    const trialSent = await processTrialAutomations();
    return json({ ok: true, queue_sent: queueSent, trial_sent: trialSent });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
