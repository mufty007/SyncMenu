import LegalLayout, { LegalSection } from "./LegalLayout";

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" updated="July 4, 2026">
      <LegalSection title="1. The service">
        <p>
          SyncMenu provides cloud-based digital menu boards: a dashboard for
          managing menus, a browser-based player for displaying them on
          screens, and public customer-facing menu pages. These terms are a
          contract between you and SyncMenu; by creating an account you accept
          them.
        </p>
      </LegalSection>

      <LegalSection title="2. Your account">
        <p>
          You're responsible for your account credentials and for everything
          done under your account. Keep your password safe and tell us
          immediately if you suspect unauthorized access. You must be at least
          18 and authorized to act for the business you register.
        </p>
      </LegalSection>

      <LegalSection title="3. Subscriptions and trials">
        <p>
          Paid plans are billed monthly or annually via Stripe and renew
          automatically until cancelled. New accounts start with a free trial;
          when it ends, a paid subscription is required to continue using the
          service. You can cancel any time — your plan stays active until the
          end of the paid period, and we don't offer partial refunds unless the
          law requires them.
        </p>
      </LegalSection>

      <LegalSection title="4. Plan limits">
        <p>
          Each plan includes limits (screens, saved menus, image storage) shown
          on the pricing page. We may enforce these limits technically. If you
          exceed them, we'll ask you to upgrade rather than delete your
          content.
        </p>
      </LegalSection>

      <LegalSection title="5. Your content">
        <p>
          You own everything you upload — menus, photos, logos, prices. You
          grant us a license to store, process, and display that content solely
          to operate the service (for example, rendering it on your screens
          and public pages). You're responsible for having the rights to the
          content you upload and for the accuracy of your menus, prices, and
          dietary information.
        </p>
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <p>
          Don't use SyncMenu to display unlawful, deceptive, or infringing
          content; don't attempt to breach or overload the service; don't
          resell it without our written agreement. We may suspend accounts that
          violate these rules, with notice where practical.
        </p>
      </LegalSection>

      <LegalSection title="7. Availability">
        <p>
          We work hard to keep the service available, and players are designed
          to keep displaying cached content through outages. However, the
          service is provided "as is" and we don't guarantee uninterrupted
          availability.
        </p>
      </LegalSection>

      <LegalSection title="8. Liability">
        <p>
          To the maximum extent permitted by law, our total liability for any
          claim related to the service is limited to the amount you paid us in
          the 12 months before the claim. We are not liable for indirect
          damages such as lost profits or lost business.
        </p>
      </LegalSection>

      <LegalSection title="9. Termination">
        <p>
          You can delete your account at any time. We may terminate or suspend
          the service for material breach of these terms. After termination,
          your content is handled as described in our Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to these terms">
        <p>
          We may update these terms; material changes will be announced by
          email or in-app at least 14 days before they take effect. Continuing
          to use the service after that means you accept the new terms.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          Questions? Email{" "}
          <a href="mailto:support@syncmenu.app" className="font-medium text-brand">
            support@syncmenu.app
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
