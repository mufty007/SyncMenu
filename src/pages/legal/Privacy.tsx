import LegalLayout, { LegalSection } from "./LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="July 11, 2026">
      <LegalSection title="1. What this covers">
        <p>
          This policy explains what information SyncMenu ("we", "us") collects
          when you use our website, dashboard, kiosk player, and customer-facing
          menu pages, and how we handle it. By using SyncMenu you agree to this
          policy.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>
          <strong>Account information.</strong> Your email address and password
          (stored as a secure hash) when you create an account.
        </p>
        <p>
          <strong>Restaurant content.</strong> Your restaurant name, logo, menu
          items, prices, descriptions, photos, links to ordering platforms and
          social profiles — everything you add to power your menus and public
          page.
        </p>
        <p>
          <strong>Device and usage data.</strong> Paired screens store a device
          token so they can display your content. We record when a screen was
          last seen online so you can monitor it from the dashboard.
        </p>
        <p>
          <strong>Billing information.</strong> Payments are processed by
          Stripe. We never see or store your full card details.
        </p>
        <p>
          <strong>Clover integration (optional).</strong> If you connect Clover
          for delivery menu sync, we store OAuth tokens to push your menu to your
          Clover account. Clover&apos;s own privacy policy governs data they
          process on their platform.
        </p>
      </LegalSection>

      <LegalSection title="3. How we use it">
        <p>
          We use your information solely to provide the service: displaying
          your menus on your screens, serving your public menu pages, syncing
          changes in real time, managing your subscription, and responding to
          support requests. We do not sell your data or use it for third-party
          advertising.
        </p>
      </LegalSection>

      <LegalSection title="4. Public content">
        <p>
          Content you publish is, by design, public: menus shown on your
          screens, your public restaurant page (menus, ordering links, social
          profiles), and printable QR codes that link to them. Anyone with the
          link or QR code can view this content. You can unpublish menus or
          remove links at any time from the dashboard.
        </p>
      </LegalSection>

      <LegalSection title="5. Service providers">
        <p>
          We rely on a small number of processors to run SyncMenu: Supabase
          (database, authentication, file storage, real-time sync), Stripe
          (payments), Clover (optional POS menu sync when you connect your
          account), and our hosting provider. Each receives only the data
          needed to perform its function.
        </p>
      </LegalSection>

      <LegalSection title="6. Cookies and local storage">
        <p>
          We use local storage and cookies only for essential functions:
          keeping you signed in, remembering dashboard preferences, and caching
          menu content on paired screens so they survive network drops. We do
          not use tracking or advertising cookies.
        </p>
      </LegalSection>

      <LegalSection title="7. Data retention and deletion">
        <p>
          Your data is retained while your account is active. If you cancel,
          we retain your content for 90 days so you can reactivate, then delete
          it. You can request earlier deletion of your account and all
          associated data at any time by contacting us.
        </p>
      </LegalSection>

      <LegalSection title="8. Security">
        <p>
          All traffic is encrypted in transit (HTTPS). Access to your data is
          scoped to your account with row-level security. Screens authenticate
          with revocable device tokens — your login credentials are never
          stored on a TV.
        </p>
      </LegalSection>

      <LegalSection title="9. Your rights">
        <p>
          You may access, correct, export, or delete your personal data.
          Depending on where you live, you may have additional rights under
          laws such as the GDPR or CCPA. To exercise any of these, email{" "}
          <a href="mailto:support@syncmenu.app" className="font-medium text-brand">
            support@syncmenu.app
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="10. Changes">
        <p>
          If we make material changes to this policy we will notify you by
          email or an in-app notice before they take effect.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
