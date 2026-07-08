# SyncMenu

Cloud-based digital menu boards for small restaurants. Owners manage menus from
a web dashboard; any TV/tablet with a browser becomes a live menu board that
updates in real time. See `prd.md` (product spec) and `brand-guide.md`
(brand system).

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS v4, Supabase
(Postgres, Auth, Realtime, Storage), Stripe (planned).

## Setup

1. **Install dependencies**

   ```sh
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com) (free
   tier works).

3. **Run the migrations**: open the Supabase SQL editor and run, in order,
   `supabase/migrations/0001_init.sql` through `0007_plan_pricing_limits.sql`.

4. **Configure env**: copy `.env.example` to `.env` and fill in your project
   URL and anon key (Project Settings → API).

5. **(Recommended)** In Supabase → Authentication → Providers → Email, disable
   "Confirm email" for a friction-free signup during development.

6. **Run it**

   ```sh
   npm run dev
   ```

## How it fits together

| Route | What it is |
|---|---|
| `/` | Marketing landing page |
| `/signup`, `/login`, `/onboarding` | Auth + restaurant profile setup |
| `/app/...` | Owner dashboard: menus, screens, playlists, settings, billing |
| `/pair/:code` | Owner-side pairing confirmation (opened from the QR code) |
| `/play` | Kiosk player — open this on the TV (append `?reset` to un-pair) |
| `/m/:menuId` | Public customer menu — linked from the per-menu QR code in the editor |
| `/r/:restaurantId` | Public restaurant hub — menus, ordering links & socials (the QR to print) |
| `/app/print-qr/:format` | Printable QR kit: `poster`, `tent`, or `stickers` |

### Pairing flow

1. TV opens `/play` → calls `create_pairing_session` RPC → shows QR + 6-letter code.
2. Owner scans the QR (or types the code under Screens → Add screen) →
   `claim_pairing_session` creates the screen and issues a device token.
3. TV polls `check_pairing_session`, receives its long-lived revocable token,
   stores it in localStorage, and goes live. Removing a screen in the dashboard
   revokes the token.

### Real-time sync

Database triggers call `realtime.send()` on every menu/playlist/screen change,
broadcasting to topic `screen:<screen_id>`. The player subscribes to its topic
and refetches via the `get_screen_content` RPC (its only data path — RLS keeps
all tables owner-scoped). A 30s poll doubles as heartbeat (powers the
online/offline indicator) and as a fallback if realtime drops. Last-known
content is cached in localStorage so a network drop never blanks the screen.

## Kiosk setup (getting rid of browser bars on TVs)

- The player asks for one tap / OK press and goes **fullscreen** via the
  Fullscreen API; it also requests a **wake lock** so screens don't sleep.
- The app ships a **PWA manifest** (`display: fullscreen`, start URL `/play`) —
  on tablets/Android "Add to Home Screen" launches the player with no browser
  UI. (Production TODO: add PNG manifest icons alongside the SVG.)
- **Recommended shop setup**: a ~$25 Fire TV / Google TV stick running
  **Fully Kiosk Browser** with the player URL as its Start URL, "Launch on
  boot" and "Keep screen on" enabled — true fullscreen, survives power cuts.
  The in-app guide lives at `/app/setup-tv`.

## Stripe billing (Khidmah platform account)

SyncMenu billing uses a **shared Khidmah Stripe account**. Prices are loaded
dynamically from product `prod_UqPvU72LORrOEE` by matching Stripe price
nicknames (`Starter`, `Growth`, `Pro`, `Starter Yearly`, etc.) — no hardcoded
price IDs in the repo.

1. Run `supabase/migrations/0004_subscriptions.sql` (and later migrations).
2. In the **Khidmah** Stripe account, confirm the SyncMenu product has six
   prices with these **nicknames** (already shown in your dashboard):
   - `Starter` ($15/mo), `Growth` ($30/mo), `Pro` ($99/mo)
   - `Starter Yearly`, `Growth Yearly`, `Pro Yearly`
3. Create a **webhook** pointing at your deployed `stripe-webhook` function
   (events: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`).
4. Set Supabase secrets and deploy:

   ```sh
   npx supabase login
   npx supabase link --project-ref hhncgqdqnznnlcoswmrm
   npx supabase secrets set \
     STRIPE_SECRET_KEY=sk_test_... \
     STRIPE_WEBHOOK_SECRET=whsec_... \
     STRIPE_PRODUCT_ID=prod_UqPvU72LORrOEE \
     STRIPE_SAAS_APP=syncmenu
   npx supabase functions deploy create-checkout-session customer-portal stripe-webhook on-user-created send-announcement unsubscribe
   ```

   Optional: `STRIPE_PORTAL_CONFIGURATION=bpc_...` if you created a portal
   config in the shared account.

5. On **Vercel**, set `VITE_STRIPE_LIVE=false` (or `true` when you go live)
   so platform admin “Open in Stripe” links use test vs live dashboard URLs.

6. Test: Billing → Subscribe → card `4242 4242 4242 4242` → webhook syncs
   plan to the database; platform `/platform/billing` reflects the change.

Going live: swap `STRIPE_SECRET_KEY` and webhook secret for live keys, set
`VITE_STRIPE_LIVE=true`, redeploy functions + Vercel.

## Platform admin (`/platform`)

After running `0005_platform_admin.sql`, seed your super admin(s) in the SQL
editor (max 3):

```sql
insert into public.platform_admins (user_id, email)
select id, email from auth.users where email = 'you@example.com';
```

Set email secrets:

```sh
npx supabase secrets set SMTP2GO_API_KEY=... SMTP2GO_SENDER=hello@syncmenu.app SITE_ORIGIN=https://syncmenu.vercel.app
```

Platform console routes: `/platform` (overview), `/platform/tenants`,
`/platform/billing`, `/platform/emails`, `/platform/admins`, `/platform/audit`.

## Not wired up yet

- **Storage quota enforcement** (100 MB/account) — uploads work; the server-side
  quota check is still to do.
- Screen limit (2) and menu limit (10) **are** enforced.
