/** Stripe-hosted画面の種類。種類ごとに許可するhostnameを固定する。 */
export type StripeHostedPage = "checkout" | "portal";

const STRIPE_HOSTNAMES: Readonly<Record<StripeHostedPage, string>> = {
  checkout: "checkout.stripe.com",
  portal: "billing.stripe.com",
};

/**
 * Backendが返した短命URLを、HTTPSかつ用途別のStripe公式hostnameの場合だけ外部遷移に使用する。
 * URLはWeb Storage、Router query、ログへ保存しない。
 *
 * @param value Backendが返したStripe-hosted URL
 * @param page 遷移先がCheckoutまたはCustomer Portalのどちらか
 * @returns 外部遷移を開始した場合true、不正URLまたはブラウザー外の実行ではfalse
 */
export const redirectToStripeHostedPage = (value: string, page: StripeHostedPage): boolean => {
  let target: URL;
  try {
    target = new URL(value);
  } catch (_error: unknown) {
    return false;
  }
  if (target.protocol !== "https:" || target.hostname !== STRIPE_HOSTNAMES[page]) {
    return false;
  }
  if (typeof window === "undefined") {
    return false;
  }
  window.location.assign(target.toString());
  return true;
};
