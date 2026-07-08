/** Stripe Dashboard deep links (test vs live controlled by VITE_STRIPE_LIVE). */
export function stripeCustomerUrl(customerId: string): string {
  const live = import.meta.env.VITE_STRIPE_LIVE === "true";
  const prefix = live ? "" : "test/";
  return `https://dashboard.stripe.com/${prefix}customers/${customerId}`;
}

export function stripeSubscriptionUrl(subscriptionId: string): string {
  const live = import.meta.env.VITE_STRIPE_LIVE === "true";
  const prefix = live ? "" : "test/";
  return `https://dashboard.stripe.com/${prefix}subscriptions/${subscriptionId}`;
}
