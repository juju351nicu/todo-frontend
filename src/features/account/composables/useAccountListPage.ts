import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { ROUTE_NAMES } from "@/app/router/routeNames";
import { AccountApiError } from "@/features/account/api/accountApi";
import { ACCOUNT_MESSAGES } from "@/features/account/constants/accountMessages";
import { useAccountStore } from "@/features/account/stores/account";
import type { AccountListItem } from "@/features/account/types/account";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { useUserStore } from "@/features/auth/stores/user";
import { DATA_TABLE_PAGE_OPTIONS, DEFAULT_ITEMS_PER_PAGE } from "@/shared/constants/ui";
import type { DataTableHeader } from "@/shared/types/dataTable";
import { isUnauthorizedApiError } from "@/shared/utils/apiError";
import { formatShortDateTime } from "@/shared/utils/dateTime";

const ACCOUNT_TABLE_HEADERS: DataTableHeader[] = [
  {
    title: "ID",
    align: "start",
    sortable: false,
    key: "accountId",
  },
  { title: "苗字", align: "start", key: "lastName" },
  { title: "名前", align: "start", key: "firstName" },
  { title: "ログインID", align: "start", key: "loginId" },
  { title: "登録日", align: "start", key: "createdAt" },
  { title: "更新日", align: "start", key: "updatedAt" },
  { title: "最終ログインした時刻", align: "start", key: "lastLoginAt" },
  { title: "編集", align: "start", sortable: false, key: "actions" },
];

/**
 * アカウント一覧の登録日・更新日・最終ログイン日時（BackendのISO日時）を、利用端末のタイムゾーンの短い日時へ変換する。
 * 並べ替えはISO文字列のまま行うため、行データは変えずにcellの表示だけで使う。
 *
 * @param value BackendのISO日時。未登録・未ログインはnull
 * @returns nullの場合は空文字
 */
export const formatAccountDateTime = (value: string | null): string =>
  value === null ? "" : formatShortDateTime(value);

/**
 * アカウント一覧画面の状態と操作を提供する。
 *
 * 削除（行の選択と「削除確認する」）は`ACCOUNT_UPDATE`を持つ利用者だけに出す（`canDeleteAccounts`）。
 * BackendはこのpermissionがないDELETEを403で拒否するため、押しても必ず失敗するボタンを出さない
 * 最終的な認可はBackendが行う。
 */
export const useAccountListPage = () => {
  const router = useRouter();
  const accountStore = useAccountStore();
  const userStore = useUserStore();
  const { expireSession } = useSessionExpiry();

  const headers = ACCOUNT_TABLE_HEADERS;
  const isLoading = computed<boolean>(() => accountStore.isLoading);
  const itemsPerPage = ref<number>(DEFAULT_ITEMS_PER_PAGE);
  const accounts = computed<AccountListItem[]>(() => accountStore.accounts);
  const itemsPerPageOptions = DATA_TABLE_PAGE_OPTIONS;
  const selectedIds = ref<number[]>([]);
  /** 一覧の取得・削除に失敗したときの理由。次の操作を始めたときに消す。 */
  const errorMessages = ref<string[]>([]);
  /** アカウントを削除できるか（Backendの`AccountAccessLogic#canDisableAccounts`と同じ`ACCOUNT_UPDATE`）。 */
  const canDeleteAccounts = computed<boolean>(() => userStore.hasPermission("ACCOUNT_UPDATE"));

  /**
   * アカウントAPIの失敗を画面の文言にする。Sessionが切れていた（401）場合は、選択を捨ててログイン画面へ戻す。
   *
   * @param error アカウントAPIの例外
   * @param fallbackMessage 401・403以外で出す文言
   * @param forbiddenMessage 403で出す文言。省略時はfallbackMessage
   */
  const handleApiError = async (
    error: unknown,
    fallbackMessage: string,
    forbiddenMessage: string = fallbackMessage
  ): Promise<void> => {
    if (isUnauthorizedApiError(error)) {
      await expireSession(() => {
        selectedIds.value = [];
        errorMessages.value = [];
      });
      return;
    }
    errorMessages.value = [
      error instanceof AccountApiError && error.status === 403 ? forbiddenMessage : fallbackMessage,
    ];
  };

  /** アカウント一覧をBackendから取得する。 */
  const initialize = async (): Promise<void> => {
    errorMessages.value = [];
    try {
      await accountStore.findAccountList();
    } catch (error: unknown) {
      await handleApiError(error, ACCOUNT_MESSAGES.listLoadFailed);
    }
  };

  /**
   * 選択したアカウントを削除する。削除できたら、消えた行を選択したままにしないよう選択を外す。
   * 失敗したら選択を残し、理由を出して再操作できるようにする。
   */
  const deleteSelectedAccounts = async (): Promise<void> => {
    errorMessages.value = [];
    try {
      await accountStore.deleteAccounts(selectedIds.value);
      selectedIds.value = [];
    } catch (error: unknown) {
      await handleApiError(error, ACCOUNT_MESSAGES.deleteFailed, ACCOUNT_MESSAGES.deleteForbidden);
    }
  };

  /**
   * アカウント設定画面へ移動する。
   *
   * @param account アカウント一覧の行情報
   */
  const showAccountDetail = (account: AccountListItem): void => {
    void router.push({
      name: ROUTE_NAMES.accountDetail,
      params: { id: account.accountId },
    });
  };

  return {
    accounts,
    canDeleteAccounts,
    deleteSelectedAccounts,
    errorMessages,
    headers,
    initialize,
    isLoading,
    itemsPerPage,
    itemsPerPageOptions,
    selectedIds,
    showAccountDetail,
  };
};
