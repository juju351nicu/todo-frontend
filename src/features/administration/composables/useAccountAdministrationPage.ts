import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import AdministrationApi, {
  AdministrationApiError,
} from "@/features/administration/api/administrationApi";
import type {
  AccountAuthorization,
  AdministrationRole,
} from "@/features/administration/types/administration";
import {
  ACCOUNT_ADMINISTRATION_ERROR_CODES,
  ADMINISTRATION_RECOVERY_PRIORITY_STATUSES,
} from "@/features/administration/utils/apiErrors";
import { useUserStore } from "@/features/auth/stores/user";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import {
  DATA_TABLE_PAGE_OPTIONS,
  DEFAULT_ITEMS_PER_PAGE,
} from "@/shared/constants/ui";
import type { DataTableHeader } from "@/shared/types/dataTable";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";

const ACCOUNT_TABLE_HEADERS: DataTableHeader[] = [
  { title: "ID", align: "end", key: "accountId" },
  { title: "表示名", align: "start", key: "displayName" },
  { title: "メールアドレス", align: "start", key: "email" },
  { title: "状態", align: "start", key: "status" },
  { title: "ロール", align: "start", key: "roleCodes", sortable: false },
  { title: "操作", align: "center", key: "actions", sortable: false },
];

/** ロールコード集合が順序にかかわらず一致するか判定する。 */
const hasSameRoleCodes = (
  first: readonly string[],
  second: readonly string[]
): boolean => {
  const firstSorted = [...first].sort();
  const secondSorted = [...second].sort();
  return (
    firstSorted.length === secondSorted.length &&
    firstSorted.every((roleCode, index) => roleCode === secondSorted[index])
  );
};

/**
 * 管理者向けアカウント・ロール管理画面の一覧、検索、編集Dialog、更新を提供する。
 * 画面の表示可否はpermissionで案内し、最終認可と楽観ロックはBackendへ委ねる。
 */
export const useAccountAdministrationPage = () => {
  const router = useRouter();
  const userStore = useUserStore();

  const accounts = ref<AccountAuthorization[]>([]);
  const errorMessages = ref<string[]>([]);
  const headers = ACCOUNT_TABLE_HEADERS;
  const isEditorOpen = ref(false);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const itemsPerPage = ref(DEFAULT_ITEMS_PER_PAGE);
  const itemsPerPageOptions = DATA_TABLE_PAGE_OPTIONS;
  const roles = ref<AdministrationRole[]>([]);
  const searchText = ref<string>("");
  const selectedAccount = ref<AccountAuthorization | null>(null);
  const selectedRoleCodes = ref<string[]>([]);
  const successMessage = ref("");

  const canEditRoles = computed(() =>
    userStore.hasPermission("ACCOUNT_ROLE_UPDATE")
  );

  const canSaveRoles = computed(
    () =>
      canEditRoles.value &&
      selectedAccount.value !== null &&
      selectedRoleCodes.value.length > 0 &&
      !isSaving.value
  );

  const filteredAccounts = computed(() => {
    const keyword = searchText.value.trim().toLocaleLowerCase();
    if (keyword.length === 0) {
      return accounts.value;
    }
    return accounts.value.filter((account) =>
      [
        String(account.accountId),
        account.displayName,
        account.email ?? "",
        account.status,
        ...account.roleCodes,
        ...account.roleCodes.map(
          (roleCode) =>
            roles.value.find((role) => role.roleCode === roleCode)?.roleName ??
            roleCode
        ),
      ].some((value) => value.toLocaleLowerCase().includes(keyword))
    );
  });

  const isEditingCurrentAccount = computed(
    () => selectedAccount.value?.accountId === userStore.memberId
  );

  /** 認証・認可・公開範囲が変化した場合に管理対象データと編集draftを破棄する。 */
  const clearProtectedState = (): void => {
    accounts.value = [];
    roles.value = [];
    isEditorOpen.value = false;
    selectedAccount.value = null;
    selectedRoleCodes.value = [];
    successMessage.value = "";
  };

  /** 一覧と選択可能ロールを同じ画面スナップショットとして再取得する。 */
  const loadAdministrationData = async (): Promise<void> => {
    isLoading.value = true;
    errorMessages.value = [];
    try {
      const [accountValues, roleValues] = await Promise.all([
        AdministrationApi.getAccounts(),
        AdministrationApi.getRoles(),
      ]);
      accounts.value = accountValues;
      roles.value = roleValues;
    } catch (error: unknown) {
      if (
        error instanceof AdministrationApiError &&
        (error.status === 403 || error.status === 404)
      ) {
        clearProtectedState();
      }
      await handleApiError(
        error,
        DISPLAY_MESSAGES.administration.account.loadFailed,
        DISPLAY_MESSAGES.administration.account.readForbidden
      );
    } finally {
      isLoading.value = false;
    }
  };

  /** 画面初期表示に必要なアカウントとロールを取得する。 */
  const initialize = async (): Promise<void> => {
    await loadAdministrationData();
  };

  /** 対象アカウントの現在ロールを複製して編集Dialogを開く。 */
  const openRoleEditor = (account: AccountAuthorization): void => {
    errorMessages.value = [];
    successMessage.value = "";
    if (!canEditRoles.value) {
      errorMessages.value = [
        DISPLAY_MESSAGES.administration.account.operationForbidden,
      ];
      return;
    }
    selectedAccount.value = account;
    selectedRoleCodes.value = [...account.roleCodes];
    isEditorOpen.value = true;
  };

  /** 更新中でない場合に編集内容を破棄してDialogを閉じる。 */
  const closeRoleEditor = (): void => {
    if (isSaving.value) {
      return;
    }
    isEditorOpen.value = false;
    selectedAccount.value = null;
    selectedRoleCodes.value = [];
  };

  /** ロールコードをBackendの表示名へ変換する。未定義コードはコード自体を表示する。 */
  const getRoleName = (roleCode: string): string =>
    roles.value.find((role) => role.roleCode === roleCode)?.roleName ?? roleCode;

  /**
   * 選択したロール集合を楽観ロック付きで保存する。
   * 自分自身のロールが変わった場合はBackendがSessionを無効化するため、Frontend状態も破棄して再ログインさせる。
   */
  const saveRoles = async (): Promise<void> => {
    const account = selectedAccount.value;
    if (isSaving.value) {
      return;
    }
    if (!canEditRoles.value) {
      errorMessages.value = [
        DISPLAY_MESSAGES.administration.account.operationForbidden,
      ];
      return;
    }
    if (account === null) {
      errorMessages.value = [
        DISPLAY_MESSAGES.administration.account.targetRequired,
      ];
      return;
    }
    if (selectedRoleCodes.value.length === 0) {
      errorMessages.value = [
        DISPLAY_MESSAGES.administration.account.roleSelectionRequired,
      ];
      return;
    }

    isSaving.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    const rolesChanged = !hasSameRoleCodes(
      account.roleCodes,
      selectedRoleCodes.value
    );
    try {
      const updatedAccount = await AdministrationApi.updateAccountRoles(
        account.accountId,
        {
          roleCodes: [...selectedRoleCodes.value],
          version: account.version,
        }
      );
      accounts.value = accounts.value.map((value) =>
        value.accountId === updatedAccount.accountId ? updatedAccount : value
      );
      closeRoleEditorAfterSaving();

      if (account.accountId === userStore.memberId && rolesChanged) {
        // Backendは権限変更commit後に対象者の全HttpSessionを削除するため、古い画面権限を保持しない。
        clearProtectedState();
        errorMessages.value = [];
        userStore.clearSession();
        await router.push({ name: "Login" });
        return;
      }
      successMessage.value = `${updatedAccount.displayName}さんのロールを更新しました。`;
    } catch (error: unknown) {
      if (await handleUnauthorized(error)) {
        return;
      }
      const operationMessages = getErrorMessages(
        error,
        DISPLAY_MESSAGES.administration.account.updateFailed,
        DISPLAY_MESSAGES.administration.account.operationForbidden
      );
      errorMessages.value = operationMessages;
      if (
        error instanceof AdministrationApiError &&
        (error.status === 404 || error.status === 409)
      ) {
        closeRoleEditorAfterSaving();
        accounts.value = [];
        await reloadAccountsAfterConflict(operationMessages);
      }
    } finally {
      isSaving.value = false;
    }
  };

  /** 保存成功時だけ、isSavingに関係なく編集Dialogの状態を破棄する。 */
  const closeRoleEditorAfterSaving = (): void => {
    isEditorOpen.value = false;
    selectedAccount.value = null;
    selectedRoleCodes.value = [];
  };

  /** 404／409後に最新versionを再取得し、古い対象と編集draftを画面へ残さない。 */
  const reloadAccountsAfterConflict = async (
    operationMessages: string[]
  ): Promise<void> => {
    try {
      accounts.value = await AdministrationApi.getAccounts();
    } catch (error: unknown) {
      if (
        error instanceof AdministrationApiError &&
        ADMINISTRATION_RECOVERY_PRIORITY_STATUSES.has(error.status)
      ) {
        if (await handleUnauthorized(error)) {
          return;
        }
        clearProtectedState();
        errorMessages.value = getErrorMessages(
          error,
          DISPLAY_MESSAGES.administration.account.reloadFailed,
          DISPLAY_MESSAGES.administration.account.readForbidden
        );
        return;
      }
      errorMessages.value = [
        ...operationMessages,
        DISPLAY_MESSAGES.administration.account.reloadFailed,
      ];
    }
  };

  /** API statusと契約済みerror codeをAccount管理向け表示へ変換する。 */
  const getErrorMessages = (
    error: unknown,
    fallbackMessage: string,
    forbiddenMessage: string
  ): string[] => {
    if (!(error instanceof AdministrationApiError)) {
      return [DISPLAY_MESSAGES.common.connectionFailed];
    }
    if (error.status === 403) {
      return [forbiddenMessage];
    }
    if (error.status === 404) {
      return [DISPLAY_MESSAGES.administration.account.resourceNotFound];
    }
    return resolveApiErrorMessages(
      error.errorResponse,
      ACCOUNT_ADMINISTRATION_ERROR_CODES,
      fallbackMessage
    );
  };

  /** 401では管理対象データとSession表示を破棄してLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof AdministrationApiError) || error.status !== 401) {
      return false;
    }
    clearProtectedState();
    errorMessages.value = [];
    userStore.clearSession();
    await router.push({ name: "Login" });
    return true;
  };

  /** HTTP statusと共通項目エラーを、認証状態を含む画面動作へ変換する。 */
  const handleApiError = async (
    error: unknown,
    fallbackMessage: string,
    forbiddenMessage: string
  ): Promise<void> => {
    if (await handleUnauthorized(error)) {
      return;
    }
    errorMessages.value = getErrorMessages(
      error,
      fallbackMessage,
      forbiddenMessage
    );
  };

  return {
    accounts,
    canEditRoles,
    canSaveRoles,
    closeRoleEditor,
    errorMessages,
    filteredAccounts,
    getRoleName,
    headers,
    initialize,
    isEditorOpen,
    isEditingCurrentAccount,
    isLoading,
    isSaving,
    itemsPerPage,
    itemsPerPageOptions,
    openRoleEditor,
    roles,
    saveRoles,
    searchText,
    selectedAccount,
    selectedRoleCodes,
    successMessage,
  };
};
