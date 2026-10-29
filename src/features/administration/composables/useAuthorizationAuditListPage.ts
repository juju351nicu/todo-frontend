import { computed, ref } from "vue";

import AdministrationApi, {
  AdministrationApiError,
} from "@/features/administration/api/administrationApi";
import type {
  AdministrationRole,
  AuthorizationAuditLog,
} from "@/features/administration/types/administration";
import { AUTHORIZATION_AUDIT_ERROR_CODES } from "@/features/administration/utils/apiErrors";
import {
  formatRoleNames,
  resolveRoleName,
} from "@/features/administration/utils/authorizationAudit";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import type { DataTableHeader } from "@/shared/types/dataTable";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";

const AUDIT_TABLE_HEADERS: DataTableHeader[] = [
  { title: "操作日時", align: "start", key: "occurredAt", sortable: false },
  { title: "操作者", align: "start", key: "actorDisplayName", sortable: false },
  { title: "変更対象", align: "start", key: "targetDisplayName", sortable: false },
  { title: "操作", align: "center", key: "action", sortable: false },
  { title: "対象ロール", align: "start", key: "roleCode", sortable: false },
  { title: "変更前", align: "start", key: "beforeRoleCodes", sortable: false },
  { title: "変更後", align: "start", key: "afterRoleCodes", sortable: false },
];

/** Backend監査APIで許可されるページサイズ選択肢。 */
const AUTHORIZATION_AUDIT_PAGE_SIZES = [20, 50, 100] as const;

/**
 * 権限変更監査ログ画面のページング取得と認証エラー処理を提供する。
 * 画面の1始まりページ番号（`UPagination`）はAPI呼出境界でBackendの0始まりへ変換する。
 *
 * ロールは監査ログにコードで記録されるため、初期化時にロール一覧API（`ACCOUNT_READ`）も取得し、
 * `formatRole`・`formatRoles`で表示名へ変換する。ロール一覧を取得できない場合はコードのまま表示する。
 */
export const useAuthorizationAuditListPage = () => {
  const { expireSession } = useSessionExpiry();

  const auditLogs = ref<AuthorizationAuditLog[]>([]);
  const errorMessages = ref<string[]>([]);
  const headers = AUDIT_TABLE_HEADERS;
  const isLoading = ref(false);
  const page = ref(1);
  const pageSize = ref<number>(50);
  const pageSizes: number[] = [...AUTHORIZATION_AUDIT_PAGE_SIZES];
  const totalElements = ref(0);
  const totalPages = ref(0);
  const roles = ref<AdministrationRole[]>([]);
  const roleNamesByCode = computed<ReadonlyMap<string, string>>(
    () => new Map(roles.value.map((role) => [role.roleCode, role.roleName]))
  );

  /** 認証・認可状態が変化した場合に監査ログと件数を画面から破棄する。 */
  const clearProtectedState = (): void => {
    auditLogs.value = [];
    totalElements.value = 0;
    totalPages.value = 0;
  };

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

  /**
   * ロールの表示名をBackendから取得する。
   * 監査ログの閲覧（`AUTHORIZATION_AUDIT_READ`）とロール一覧（`ACCOUNT_READ`）はpermissionが別のため、
   * 失敗しても監査ログの表示は止めず、ロールをコードのまま表示する。Session切れは監査ログ側の401で処理する。
   */
  const loadRoleNames = async (): Promise<void> => {
    try {
      roles.value = await AdministrationApi.getRoles();
    } catch {
      roles.value = [];
    }
  };

  /** 監査ログ一覧の先頭ページとロールの表示名を並行して取得する。 */
  const initialize = async (): Promise<void> => {
    await Promise.all([loadAuditLogs(), loadRoleNames()]);
  };

  /** ロールコードを表示名へ変換する。表示名がないコードはそのまま返す。 */
  const formatRole = (roleCode: string): string => resolveRoleName(roleCode, roleNamesByCode.value);

  /** ロールコード集合を読点区切りの表示名へ変換する。空集合は「なし」。 */
  const formatRoles = (roleCodes: readonly string[]): string =>
    formatRoleNames(roleCodes, roleNamesByCode.value);

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
      clearProtectedState();
      errorMessages.value = [DISPLAY_MESSAGES.administration.audit.readForbidden];
      return;
    }
    errorMessages.value = resolveApiErrorMessages(
      error.errorResponse,
      AUTHORIZATION_AUDIT_ERROR_CODES,
      DISPLAY_MESSAGES.administration.audit.loadFailed
    );
  };

  return {
    auditLogs,
    changePage,
    changePageSize,
    errorMessages,
    formatRole,
    formatRoles,
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
