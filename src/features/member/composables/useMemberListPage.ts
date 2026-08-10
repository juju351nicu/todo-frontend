import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import Const from "@/constants/const";
import { useMemberStore } from "@/features/member/stores/member";
import type { MemberListItem } from "@/features/member/types/member";

interface MemberTableHeader {
  title: string;
  align: "start" | "center" | "end";
  sortable?: boolean;
  key: string;
}

const MEMBER_TABLE_HEADERS: MemberTableHeader[] = [
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
  { title: "編集", align: "start", key: "actions" },
];

/** 会員一覧画面の状態と操作を提供する。 */
export const useMemberListPage = () => {
  const router = useRouter();
  const memberStore = useMemberStore();

  const headers = MEMBER_TABLE_HEADERS;
  const isLoading = computed<boolean>(() => memberStore.isLoading);
  const itemsPerPage = ref<number>(Const.NUMBER_OF_ITEMS);
  const memberList = computed<MemberListItem[]>(
    () => memberStore.memberListInfo
  );
  const pages = Const.DATA_TABLE_PAGES;
  const selectedIds = ref<number[]>([]);

  /** 会員一覧をBackendから取得する。 */
  const initialize = async (): Promise<void> => {
    await memberStore.findMemberList();
  };

  /** 選択した会員を削除する。 */
  const deleteSelectedMembers = async (): Promise<void> => {
    await memberStore.deleteMemberList(selectedIds.value);
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
    deleteSelectedMembers,
    headers,
    initialize,
    isLoading,
    itemsPerPage,
    memberList,
    pages,
    selectedIds,
    showMemberDetail,
  };
};
