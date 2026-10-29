import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { useUserStore } from "@/features/auth/stores/user";
import { MemberApiError } from "@/features/member/api/memberApi";
import { MEMBER_MESSAGES } from "@/features/member/constants/memberMessages";
import { useMemberStore } from "@/features/member/stores/member";
import type { MemberListItem } from "@/features/member/types/member";
import {
  DATA_TABLE_PAGE_OPTIONS,
  DEFAULT_ITEMS_PER_PAGE,
} from "@/shared/constants/ui";
import type { DataTableHeader } from "@/shared/types/dataTable";
import { isUnauthorizedApiError } from "@/shared/utils/apiError";
import { formatShortDateTime } from "@/shared/utils/dateTime";

const MEMBER_TABLE_HEADERS: DataTableHeader[] = [
  {
    title: "ID",
    align: "start",
    sortable: false,
    key: "memberId",
  },
  { title: "苗字", align: "start", key: "lastName" },
  { title: "名前", align: "start", key: "firstName" },
  { title: "ログインID", align: "start", key: "loginId" },
  { title: "登録日", align: "start", key: "registeredDate" },
  { title: "更新日", align: "start", key: "updatedDate" },
  { title: "最終ログインした時刻", align: "start", key: "lastLogin" },
  { title: "編集", align: "start", sortable: false, key: "actions" },
];

/**
 * 会員一覧の登録日・更新日・最終ログイン日時（BackendのISO日時）を、利用端末のタイムゾーンの短い日時へ変換する。
 * 並べ替えはISO文字列のまま行うため、行データは変えずにcellの表示だけで使う。
 *
 * @param value BackendのISO日時。未登録・未ログインはnull
 * @returns nullの場合は空文字
 */
export const formatMemberDateTime = (value: string | null): string =>
  value === null ? "" : formatShortDateTime(value);

/**
 * 会員一覧画面の状態と操作を提供する。
 *
 * 削除（行の選択と「削除確認する」）は`ACCOUNT_UPDATE`を持つ利用者だけに出す（`canDeleteMembers`）。
 * BackendはこのpermissionがないDELETEを403で拒否するため、押しても必ず失敗するボタンを出さない
 * 最終的な認可はBackendが行う。
 */
export const useMemberListPage = () => {
  const router = useRouter();
  const memberStore = useMemberStore();
  const userStore = useUserStore();
  const { expireSession } = useSessionExpiry();

  const headers = MEMBER_TABLE_HEADERS;
  const isLoading = computed<boolean>(() => memberStore.isLoading);
  const itemsPerPage = ref<number>(DEFAULT_ITEMS_PER_PAGE);
  const memberList = computed<MemberListItem[]>(
    () => memberStore.memberListInfo
  );
  const itemsPerPageOptions = DATA_TABLE_PAGE_OPTIONS;
  const selectedIds = ref<number[]>([]);
  /** 一覧の取得・削除に失敗したときの理由。次の操作を始めたときに消す。 */
  const errorMessages = ref<string[]>([]);
  /** 会員を削除できるか（Backendの`MemberAccessLogic#canDeleteMembers`と同じ`ACCOUNT_UPDATE`）。 */
  const canDeleteMembers = computed<boolean>(() =>
    userStore.hasPermission("ACCOUNT_UPDATE")
  );

  /**
   * 会員APIの失敗を画面の文言にする。Sessionが切れていた（401）場合は、選択を捨ててログイン画面へ戻す。
   *
   * @param error 会員APIの例外
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
      error instanceof MemberApiError && error.status === 403
        ? forbiddenMessage
        : fallbackMessage,
    ];
  };

  /** 会員一覧をBackendから取得する。 */
  const initialize = async (): Promise<void> => {
    errorMessages.value = [];
    try {
      await memberStore.findMemberList();
    } catch (error: unknown) {
      await handleApiError(error, MEMBER_MESSAGES.listLoadFailed);
    }
  };

  /**
   * 選択した会員を削除する。削除できたら、消えた行を選択したままにしないよう選択を外す。
   * 失敗したら選択を残し、理由を出して再操作できるようにする。
   */
  const deleteSelectedMembers = async (): Promise<void> => {
    errorMessages.value = [];
    try {
      await memberStore.deleteMemberList(selectedIds.value);
      selectedIds.value = [];
    } catch (error: unknown) {
      await handleApiError(
        error,
        MEMBER_MESSAGES.deleteFailed,
        MEMBER_MESSAGES.deleteForbidden
      );
    }
  };

  /**
   * 会員詳細画面へ移動する。
   *
   * @param member 会員一覧の行情報
   */
  const showMemberDetail = (member: MemberListItem): void => {
    void router.push({
      name: "MemberDetail",
      params: { id: member.memberId },
    });
  };

  return {
    canDeleteMembers,
    deleteSelectedMembers,
    errorMessages,
    headers,
    initialize,
    isLoading,
    itemsPerPage,
    itemsPerPageOptions,
    memberList,
    selectedIds,
    showMemberDetail,
  };
};
