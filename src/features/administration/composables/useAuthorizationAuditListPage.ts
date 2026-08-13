import { ref } from "vue";
import { useRouter } from "vue-router";

import AdministrationApi, {
  AdministrationApiError,
} from "@/features/administration/api/administrationApi";
import type { AuthorizationAuditLog } from "@/features/administration/types/administration";
import { useUserStore } from "@/features/auth/stores/user";

interface AuthorizationAuditTableHeader {
  title: string;
  align: "start" | "center" | "end";
  key: string;
  sortable?: boolean;
}

const AUDIT_TABLE_HEADERS: AuthorizationAuditTableHeader[] = [
  { title: "操作日時", align: "start", key: "occurredAt", sortable: false },
  { title: "操作者", align: "start", key: "actorDisplayName", sortable: false },
  { title: "変更対象", align: "start", key: "targetDisplayName", sortable: false },
  { title: "操作", align: "center", key: "action", sortable: false },
  { title: "対象ロール", align: "start", key: "roleCode", sortable: false },
  { title: "変更前", align: "start", key: "beforeRoleCodes", sortable: false },
  { title: "変更後", align: "start", key: "afterRoleCodes", sortable: false },
];

/** Backend監査APIで許可されるページサイズ選択肢。 */
export const AUTHORIZATION_AUDIT_PAGE_SIZES = [20, 50, 100] as const;

/**
 * 権限変更監査ログ画面のページング取得と認証エラー処理を提供する。
 * Vuetifyの1始まりページ番号はAPI呼出境界でBackendの0始まりへ変換する。
 */
export const useAuthorizationAuditListPage = () => {
  const router = useRouter();
  const userStore = useUserStore();

  const auditLogs = ref<AuthorizationAuditLog[]>([]);
  const errorMessages = ref<string[]>([]);
  const headers = AUDIT_TABLE_HEADERS;
  const isLoading = ref(false);
  const page = ref(1);
  const pageSize = ref<number>(50);
  const pageSizes = AUTHORIZATION_AUDIT_PAGE_SIZES;
  const totalElements = ref(0);
  const totalPages = ref(0);

  /** 現在選択中のページをBackendから再取得する。読込中の二重実行は無視する。 */
  const loadAuditLogs = async (): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    isLoading.value = true;
    errorMessages.value = [];
    try {
      const response = await AdministrationApi.getAuthorizationAuditLogs(
        page.value - 1,
        pageSize.value
      );
      auditLogs.value = response.auditLogs ?? [];
      totalElements.value = response.totalElements;
      totalPages.value = response.totalPages;
      // Backendが最終ページ補正を行う場合でも、画面のページ表示をResponseへ同期する。
      page.value = response.page + 1;
    } catch (error: unknown) {
      await handleApiError(error);
    } finally {
      isLoading.value = false;
    }
  };

  /** 監査ログ一覧の先頭ページを取得する。 */
  const initialize = async (): Promise<void> => {
    await loadAuditLogs();
  };

  /** ページ番号を変更し、対応する監査ログを取得する。 */
  const changePage = async (value: number): Promise<void> => {
    page.value = value;
    await loadAuditLogs();
  };

  /** ページサイズを変更し、範囲外ページを避けるため先頭から再取得する。 */
  const changePageSize = async (value: number): Promise<void> => {
    pageSize.value = value;
    page.value = 1;
    await loadAuditLogs();
  };

  /** 監査APIの失敗を、認証状態と画面メッセージへ変換する。 */
  const handleApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof AdministrationApiError)) {
      errorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      errorMessages.value = ["監査ログを参照するpermissionがありません。"];
      return;
    }
    const fieldMessages = (error.errorResponse?.fieldErrors ?? []).map(
      (fieldError) => fieldError.message
    );
    errorMessages.value =
      fieldMessages.length > 0
        ? fieldMessages
        : ["権限変更監査ログを取得できませんでした。"];
  };

  return {
    auditLogs,
    changePage,
    changePageSize,
    errorMessages,
    headers,
    initialize,
    isLoading,
    page,
    pageSize,
    pageSizes,
    totalElements,
    totalPages,
  };
};
