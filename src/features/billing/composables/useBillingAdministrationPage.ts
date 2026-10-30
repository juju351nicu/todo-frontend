import { computed, ref } from "vue";

import BillingApi, { BillingApiError } from "@/features/billing/api/billingApi";
import type { BillingAdministrationAccount } from "@/features/billing/types/billing";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { useUserStore } from "@/features/auth/stores/user";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import type { DataTableHeader } from "@/shared/types/dataTable";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";

const BILLING_ADMINISTRATION_ERROR_CODES: ReadonlySet<string> = new Set([
  "INVALID_REQUEST_PARAMETER",
  "BILLING_STATE_CONFLICT",
  "BILLING_RECONCILIATION_CONFLICT",
  "BILLING_PROVIDER_UNAVAILABLE",
]);

const BILLING_ADMINISTRATION_HEADERS: DataTableHeader[] = [
  { title: "Account", align: "start", key: "account", sortable: false },
  { title: "状態", align: "start", key: "accountStatus", sortable: false },
  { title: "契約", align: "start", key: "subscription", sortable: false },
  { title: "利用可能機能", align: "start", key: "featureCodes", sortable: false },
  { title: "契約・支払期限", align: "start", key: "periods", sortable: false },
  { title: "同期・照合", align: "start", key: "reconciliation", sortable: false },
  { title: "操作", align: "center", key: "actions", sortable: false },
];

/** Backend課金管理APIで許可するページサイズ選択肢。 */
const BILLING_ADMINISTRATION_PAGE_SIZES = [20, 50, 100] as const;

/**
 * 課金管理Account一覧のページング、permission表示、Stripe正本との手動再照合を提供する。
 * 一覧はローカルprojectionだけを表示し、Stripe識別子や請求先情報を保持しない。
 */
export const useBillingAdministrationPage = () => {
  const userStore = useUserStore();
  const { expireSession } = useSessionExpiry();

  const accounts = ref<BillingAdministrationAccount[]>([]);
  const errorMessages = ref<string[]>([]);
  const headers = BILLING_ADMINISTRATION_HEADERS;
  const isLoading = ref(false);
  const page = ref(1);
  const pageSize = ref<number>(50);
  const pageSizes: number[] = [...BILLING_ADMINISTRATION_PAGE_SIZES];
  const reconcilingAccountId = ref<number | null>(null);
  const successMessage = ref("");
  const totalElements = ref(0);
  const totalPages = ref(0);

  const canReconcile = computed(() => userStore.hasPermission("BILLING_RECONCILE"));

  /** 認証・permissionが変化した場合に課金対象一覧と件数を画面から破棄する。 */
  const clearProtectedState = (): void => {
    accounts.value = [];
    totalElements.value = 0;
    totalPages.value = 0;
    reconcilingAccountId.value = null;
    successMessage.value = "";
  };

  /** 課金管理APIの失敗をSession失効、permission不足、安全な利用者向け文言へ変換する。 */
  const handleApiError = async (
    error: unknown,
    fallback: string,
    forbidden: string
  ): Promise<void> => {
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
      errorMessages.value = [forbidden];
      return;
    }
    errorMessages.value = resolveApiErrorMessages(
      error.errorResponse,
      BILLING_ADMINISTRATION_ERROR_CODES,
      fallback
    );
  };

  /** 現在選択中のページをBackendから再取得する。読込中の二重実行は無視する。 */
  const loadAccounts = async (): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    isLoading.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const response = await BillingApi.getAdministrationAccounts(page.value - 1, pageSize.value);
      accounts.value = response.accounts ?? [];
      totalElements.value = response.totalElements;
      totalPages.value = response.totalPages;
      page.value = response.page + 1;
    } catch (error: unknown) {
      if (error instanceof BillingApiError && error.status === 403) {
        clearProtectedState();
      }
      await handleApiError(
        error,
        DISPLAY_MESSAGES.billing.administration.loadFailed,
        DISPLAY_MESSAGES.billing.administration.readForbidden
      );
    } finally {
      isLoading.value = false;
    }
  };

  /** 課金管理一覧の先頭ページを取得する。 */
  const initialize = async (): Promise<void> => {
    await loadAccounts();
  };

  /** 画面の1始まりページ番号をBackendの0始まりへ変換して取得する。 */
  const changePage = async (value: number): Promise<void> => {
    page.value = value;
    await loadAccounts();
  };

  /** 表示件数を変更し、範囲外ページを避けるため先頭ページへ戻る。 */
  const changePageSize = async (value: number): Promise<void> => {
    pageSize.value = value;
    page.value = 1;
    await loadAccounts();
  };

  /** 対象行が手動再照合を開始できる状態か判定する。最終判定はBackendが行う。 */
  const canReconcileAccount = (account: BillingAdministrationAccount): boolean =>
    canReconcile.value &&
    account.billingCustomerConfigured &&
    !account.reconciliationInProgress &&
    reconcilingAccountId.value === null;

  /** 再照合成功後に同じページを再取得し、失敗時も確定済み操作と再読込失敗を区別する。 */
  const reloadAfterReconciliation = async (): Promise<void> => {
    try {
      const response = await BillingApi.getAdministrationAccounts(page.value - 1, pageSize.value);
      accounts.value = response.accounts ?? [];
      totalElements.value = response.totalElements;
      totalPages.value = response.totalPages;
      page.value = response.page + 1;
    } catch (error: unknown) {
      if (error instanceof BillingApiError && (error.status === 401 || error.status === 403)) {
        if (error.status === 403) {
          clearProtectedState();
        }
        await handleApiError(
          error,
          DISPLAY_MESSAGES.billing.administration.reloadFailed,
          DISPLAY_MESSAGES.billing.administration.readForbidden
        );
        return;
      }
      errorMessages.value = [DISPLAY_MESSAGES.billing.administration.reloadFailed];
    }
  };

  /** 対象AccountをStripe正本へ手動再照合し、確定後に同じ一覧ページを再取得する。 */
  const reconcileAccount = async (account: BillingAdministrationAccount): Promise<void> => {
    if (reconcilingAccountId.value !== null) {
      return;
    }
    if (!canReconcile.value) {
      errorMessages.value = [DISPLAY_MESSAGES.billing.administration.reconcileForbidden];
      return;
    }
    if (!account.billingCustomerConfigured || account.reconciliationInProgress) {
      return;
    }

    reconcilingAccountId.value = account.accountId;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      await BillingApi.reconcileAdministrationAccount(account.accountId);
      successMessage.value = DISPLAY_MESSAGES.billing.administration.reconciled(
        account.displayName
      );
      await reloadAfterReconciliation();
    } catch (error: unknown) {
      await handleApiError(
        error,
        DISPLAY_MESSAGES.billing.administration.reconcileFailed,
        DISPLAY_MESSAGES.billing.administration.reconcileForbidden
      );
    } finally {
      reconcilingAccountId.value = null;
    }
  };

  return {
    accounts,
    canReconcile,
    canReconcileAccount,
    changePage,
    changePageSize,
    errorMessages,
    headers,
    initialize,
    isLoading,
    loadAccounts,
    page,
    pageSize,
    pageSizes,
    reconcileAccount,
    reconcilingAccountId,
    successMessage,
    totalElements,
    totalPages,
  };
};
