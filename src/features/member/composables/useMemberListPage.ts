import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import { useMemberStore } from "@/features/member/stores/member";
import type { MemberListItem } from "@/features/member/types/member";
import {
  DATA_TABLE_PAGE_OPTIONS,
  DEFAULT_ITEMS_PER_PAGE,
} from "@/shared/constants/ui";
import type { DataTableHeader } from "@/shared/types/dataTable";
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
 * （確認依頼「会員一覧の見え方の変更」2、2026-10-28決定）。最終的な認可はBackendが行う。
 */
export const useMemberListPage = () => {
  const router = useRouter();
  const memberStore = useMemberStore();
  const userStore = useUserStore();

  const headers = MEMBER_TABLE_HEADERS;
  const isLoading = computed<boolean>(() => memberStore.isLoading);
  const itemsPerPage = ref<number>(DEFAULT_ITEMS_PER_PAGE);
  const memberList = computed<MemberListItem[]>(
    () => memberStore.memberListInfo
  );
  const itemsPerPageOptions = DATA_TABLE_PAGE_OPTIONS;
  const selectedIds = ref<number[]>([]);
  /** 会員を削除できるか（Backendの`MemberAccessLogic#canDeleteMembers`と同じ`ACCOUNT_UPDATE`）。 */
  const canDeleteMembers = computed<boolean>(() =>
    userStore.hasPermission("ACCOUNT_UPDATE")
  );

  /** 会員一覧をBackendから取得する。 */
  const initialize = async (): Promise<void> => {
    await memberStore.findMemberList();
  };

  /** 選択した会員を削除する。削除できたら、消えた行を選択したままにしないよう選択を外す。 */
  const deleteSelectedMembers = async (): Promise<void> => {
    if (await memberStore.deleteMemberList(selectedIds.value)) {
      selectedIds.value = [];
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
