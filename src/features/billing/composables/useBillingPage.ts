import { computed, ref } from "vue";
import { useRoute } from "vue-router";

import BillingApi, { BillingApiError } from "@/features/billing/api/billingApi";
import type { BillingMeResponse } from "@/features/billing/types/billing";
import { redirectToStripeHostedPage } from "@/features/billing/utils/stripeNavigation";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";

const BILLING_ERROR_CODES: ReadonlySet<string> = new Set([
  "INVALID_BILLING_REQUEST",
  "BILLING_PLAN_UNAVAILABLE",
  "BILLING_INTERVAL_UNAVAILABLE",
  "BILLING_ACCOUNT_UNAVAILABLE",
  "BILLING_SUBSCRIPTION_ALREADY_ACTIVE",
  "BILLING_CUSTOMER_REQUIRED",
  "BILLING_STATE_CONFLICT",
  "BILLING_PROVIDER_UNAVAILABLE",
]);

/**
 * 本人の料金・契約画面の状態、Checkout、Customer Portal、明示再読込を提供する。
 * Stripe短命URLは外部遷移にだけ使用し、Router、Store、Web Storageへ保存しない。
 */
export const useBillingPage = () => {
  const route = useRoute();
  const { expireSession } = useSessionExpiry();

  const billing = ref<BillingMeResponse | null>(null);
  const errorMessages = ref<string[]>([]);
  const informationMessage = ref("");
  const isLoading = ref(false);
  const isStartingCheckout = ref(false);
  const isOpeningPortal = ref(false);

  const isPro = computed(() => billing.value?.planCode === "PRO");
  const canStartCheckout = computed(
    () =>
      billing.value !== null &&
      !isPro.value &&
      !isLoading.value &&
      !isStartingCheckout.value &&
      !isOpeningPortal.value
  );
  const canOpenPortal = computed(
    () =>
      billing.value !== null &&
      billing.value.subscriptionStatus !== null &&
      !isLoading.value &&
      !isStartingCheckout.value &&
      !isOpeningPortal.value
  );

  /** 認証状態が失効した場合に本人の契約snapshotを画面から破棄する。 */
  const clearProtectedState = (): void => {
    billing.value = null;
    informationMessage.value = "";
  };

  /** Checkoutのreturn queryと最新projectionから、成功・取消・反映待ちの案内を決める。 */
  const updateCheckoutReturnMessage = (): void => {
    const queryValue = Array.isArray(route.query.checkout)
      ? route.query.checkout[0]
      : route.query.checkout;
    if (queryValue === "success") {
      informationMessage.value = isPro.value
        ? DISPLAY_MESSAGES.billing.checkoutCompleted
        : DISPLAY_MESSAGES.billing.checkoutPending;
      return;
    }
    if (queryValue === "cancel") {
      informationMessage.value = DISPLAY_MESSAGES.billing.checkoutCanceled;
      return;
    }
    informationMessage.value = "";
  };

  /** 課金APIの失敗をSession失効、操作禁止、安全な利用者向け文言へ変換する。 */
  const handleApiError = async (error: unknown, fallback: string): Promise<void> => {
    if (!(error instanceof BillingApiError)) {
      errorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      clearProtectedState();
      errorMessages.value = [];
      await expireSession();
      return;
    }
    if (error.status === 403) {
      errorMessages.value = [DISPLAY_MESSAGES.billing.operationForbidden];
      return;
    }
    errorMessages.value = resolveApiErrorMessages(
      error.errorResponse,
      BILLING_ERROR_CODES,
      fallback
    );
  };

  /** 本人の契約状態をBackend projectionから取得する。読込中の二重実行は無視する。 */
  const loadBilling = async (): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    isLoading.value = true;
    errorMessages.value = [];
    try {
      billing.value = await BillingApi.getMyBilling();
      updateCheckoutReturnMessage();
    } catch (error: unknown) {
      await handleApiError(error, DISPLAY_MESSAGES.billing.loadFailed);
    } finally {
      isLoading.value = false;
    }
  };

  /** 画面初期表示で本人の契約状態を1回取得する。 */
  const initialize = async (): Promise<void> => {
    await loadBilling();
  };

  /** Pro月額のCheckout Sessionを作り、検証済みStripe-hosted URLへ遷移する。 */
  const startCheckout = async (): Promise<void> => {
    if (!canStartCheckout.value) {
      return;
    }
    isStartingCheckout.value = true;
    errorMessages.value = [];
    informationMessage.value = "";
    try {
      const response = await BillingApi.createCheckoutSession({
        planCode: "PRO",
        billingInterval: "MONTHLY",
      });
      if (!redirectToStripeHostedPage(response.checkoutUrl, "checkout")) {
        errorMessages.value = [DISPLAY_MESSAGES.billing.invalidHostedUrl];
      }
    } catch (error: unknown) {
      await handleApiError(error, DISPLAY_MESSAGES.billing.checkoutFailed);
    } finally {
      isStartingCheckout.value = false;
    }
  };

  /** 本人Customer用Portal Sessionを作り、検証済みStripe-hosted URLへ遷移する。 */
  const openCustomerPortal = async (): Promise<void> => {
    if (!canOpenPortal.value) {
      return;
    }
    isOpeningPortal.value = true;
    errorMessages.value = [];
    informationMessage.value = "";
    try {
      const response = await BillingApi.createPortalSession();
      if (!redirectToStripeHostedPage(response.portalUrl, "portal")) {
        errorMessages.value = [DISPLAY_MESSAGES.billing.invalidHostedUrl];
      }
    } catch (error: unknown) {
      await handleApiError(error, DISPLAY_MESSAGES.billing.portalFailed);
    } finally {
      isOpeningPortal.value = false;
    }
  };

  return {
    billing,
    canOpenPortal,
    canStartCheckout,
    errorMessages,
    informationMessage,
    initialize,
    isLoading,
    isOpeningPortal,
    isPro,
    isStartingCheckout,
    loadBilling,
    openCustomerPortal,
    startCheckout,
  };
};
