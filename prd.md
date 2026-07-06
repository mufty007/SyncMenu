# Product Requirements Document: SyncMenu

## 1. Overview

**Product name:** SyncMenu — a cloud-based digital menu board platform for small, independent restaurants.

**Summary:** A SaaS platform that lets small restaurants (chicken shops, sandwich shops, halal spots, and similar independent food businesses) create, manage, and display digital menu boards on any screen with a browser — smart TVs, Google TV devices, tablets, or any connected display. Owners manage everything from a web dashboard, and changes sync to their screens instantly, eliminating the current USB-drive-and-redesign workflow.

**Problem statement:** Small restaurants currently display menus on TVs using static images or slides designed manually and transferred via USB drives. Any price change, item addition, or design refresh requires redesigning the file, re-exporting it, and physically re-uploading it. This is slow, error-prone, and discourages owners from keeping menus current.

**Solution:** A two-part product — an admin dashboard (where owners design and manage menus) and a kiosk display app (a browser-based, full-screen player that renders menus on any screen and updates in real time).

## 2. Target Audience

Primary: Independent restaurant owners with one or two locations — chicken shops, sandwich shops, halal restaurants, cafés, and similar small food businesses. Non-technical, price-sensitive, value simplicity over deep configurability. Explicitly NOT targeting large chains or franchises at launch.

## 3. Goals & Non-Goals

**Goals:**
- Let a non-technical owner go from signup to a live menu on a TV in under 15 minutes.
- Real-time updates: any change in the dashboard reflects on connected screens instantly.
- Professional-looking results via templates, without requiring design skills.

**Non-Goals (v1):**
- Analytics (e.g., slide view-time tracking) — explicitly deferred.
- Ordering/POS integration.
- Multi-chain / franchise management features.
- Native mobile or TV apps (browser-based player only for v1).

## 4. Core Features

### 4.1 Admin Dashboard (React web app)

**Account & Restaurant Setup**
- Email/password signup (Supabase Auth), restaurant profile (name, logo, brand colors).
- Stripe-powered subscription with a 7–14 day free trial.

**Menu Management**
- Create menus composed of sections (e.g., Appetizers, Mains, Drinks) and items.
- Each item supports: name, description, price, image, availability toggle.
- Image upload with per-account storage limits (see tier limits).

**Template & Design System**
- Library of professionally designed templates in both orientations (1920×1080 landscape and 1080×1920 portrait).
- Customization within guardrails: colors, fonts, timing, and content in predefined layout slots — users cannot break the layout (slot-based editing, not free-form canvas).
- Layout flexibility via predefined arrangements (item placement, image sizes) selected from safe presets.

**Playlists / Rotation (Carousel)**
- Assign multiple menu designs to a single screen as a rotating playlist.
- Full-page slide transitions with configurable duration per slide.
- Configurable transition animation (e.g., slide up, fade).

**Screen Management**
- Add/rename/remove screens from the dashboard.
- Assign different content to different screens independently.
- Screen status indicator: online/offline, currently displaying what.

### 4.2 Kiosk Display (browser-based player)

- Runs full-screen in any modern browser (smart TV browser, Google TV, tablet, PC).
- Supports 1920×1080 landscape and 1080×1920 portrait; orientation chosen per screen.
- **QR-code pairing:** Adding a screen generates a unique QR code / pairing URL. The TV opens the player URL, displays a pairing state, the owner scans and confirms, and the screen authenticates and begins displaying its assigned content.
- Real-time content sync via Supabase Realtime subscriptions — changes appear on screen instantly with no manual refresh.
- Offline resilience: player caches last-known content locally so a brief internet drop doesn't blank the screen; resyncs on reconnect.
- Auto-recovery: player reconnects automatically after network or power interruptions.

## 5. Pricing & Packaging

Single feature-complete subscription at launch; future modules may be sold as paid add-ons.

| | Base Tier |
|---|---|
| Price | $50/month |
| Annual option | ~15–20% discount (≈ $42/month billed annually) |
| Free trial | 7–14 days (Stripe-managed) |
| Screens included | Up to 2 |
| Templates | Up to 5 |
| Saved menus | Up to 10 |
| Image storage | 100 MB per restaurant |

A middle tier with a higher screen allowance is anticipated as the upgrade path for restaurants needing more than 2 screens (pricing TBD). Additional modules (future) unlock via add-on payments.

## 6. Technical Architecture

**Stack:** React (dashboard + kiosk player), Supabase (Postgres, Auth, Realtime, Storage), Stripe (billing), hosted on Vercel or similar.

**Key components:**
- **Dashboard app (React):** menu CRUD, template editor, screen management, billing portal.
- **Player app (React, lightweight):** subscribes to its screen's content channel via Supabase Realtime; renders templates; caches content in localStorage/IndexedDB.
- **Supabase Postgres:** tables for restaurants, users, screens, menus, menu_sections, menu_items, templates, playlists, playlist_slides, subscriptions.
- **Supabase Realtime:** publishes changes on menu/playlist/screen-assignment tables; each player subscribes to a channel scoped to its screen ID.
- **Supabase Storage:** item images and logos, with per-account quota enforcement.
- **Row-Level Security:** all data scoped to the restaurant account; screens authenticate with a scoped, revocable token issued at QR pairing (read-only access to assigned content only).
- **Stripe:** Checkout for signup, Customer Portal for plan management, webhooks to sync subscription status; tier limits enforced server-side.

**QR pairing flow:**
1. Owner clicks "Add Screen" in dashboard → system creates a screen record and a short-lived pairing code.
2. TV opens the player URL → shows a pairing screen with a QR code containing a session ID.
3. Owner scans the QR with their phone (logged into dashboard) → confirms → backend binds the session to the screen record and issues a long-lived, revocable device token.
4. Player stores token, loads assigned content, goes live.

## 7. User Flows

- **Onboarding:** Sign up → restaurant info → start trial (Stripe) → pick template → add menu items → add screen → scan QR on TV → live.
- **Daily use (price change):** Log in → open menu → edit price → save → all assigned screens update within seconds.
- **Multi-screen setup:** Add second screen → pair via QR → assign different menu/playlist → each screen displays independently.
- **Playlist setup:** Create playlist → add 2+ menu designs as slides → set per-slide duration and transition → assign to screen.

## 8. Non-Functional Requirements

- **Sync latency:** dashboard change visible on screen in under 5 seconds (target: near-instant).
- **Player uptime:** display continues rendering cached content through connectivity loss; auto-reconnect.
- **Performance:** player runs smoothly on low-powered smart TV browsers (minimal JS bundle, optimized images, hardware-friendly CSS animations).
- **Responsive rendering:** pixel-accurate at 1920×1080 and 1080×1920.
- **Security:** RLS on all tables, revocable device tokens, no owner credentials ever stored on the TV.

## 9. Success Metrics

- Time-to-first-live-screen under 15 minutes for new signups.
- Trial-to-paid conversion rate.
- Monthly churn rate.
- Weekly active dashboards (owners actually updating menus).
- Support tickets related to pairing/sync (should trend to near zero).

## 10. Future Considerations (Post-v1)

Middle/unlimited-screen tiers, paid add-on modules, analytics (slide engagement), scheduled menus (dayparting), POS integrations, multi-location chain management, native TV apps.