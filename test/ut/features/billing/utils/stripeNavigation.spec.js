import { afterEach, describe, expect, it, vi } from "vitest";

import { redirectToStripeHostedPage } from "@/features/billing/utils/stripeNavigation";

describe("Stripe-hosted画面への遷移", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("HTTPSのStripe Checkout公式hostnameだけへ遷移する", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });

    expect(
      redirectToStripeHostedPage("https://checkout.stripe.com/c/pay/session", "checkout")
    ).toBe(true);
    expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/session");
  });

  it("HTTPSのStripe Customer Portal公式hostnameだけへ遷移する", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });

    expect(redirectToStripeHostedPage("https://billing.stripe.com/p/session/test", "portal")).toBe(
      true
    );
    expect(assign).toHaveBeenCalledWith("https://billing.stripe.com/p/session/test");
  });

  it("HTTP、用途違いhostname、外部hostname、不正URLを拒否する", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });

    expect(redirectToStripeHostedPage("http://checkout.stripe.com/c/pay/session", "checkout")).toBe(
      false
    );
    expect(
      redirectToStripeHostedPage("https://billing.stripe.com/p/session/test", "checkout")
    ).toBe(false);
    expect(redirectToStripeHostedPage("https://example.com/session", "portal")).toBe(false);
    expect(redirectToStripeHostedPage("not-a-url", "portal")).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
