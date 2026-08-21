import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type { WbsResponse } from "@/features/wbs/types/wbs";
import { buildWbsTreeRows } from "@/features/wbs/utils/wbsTree";

/**
 * 読取り専用WBS画面のAPI読込、階層変換、認証エラー、Board遷移を管理する。
 * WBS編集状態は持たず、再読込のたびにBackendのTask正本から表示を作り直す。
 */
export const useWbsPage = () => {
  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();

  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const wbs = ref<WbsResponse | null>(null);

  const projectId = computed(() => {
    const value = Array.isArray(route.params.projectId)
      ? route.params.projectId[0]
      : route.params.projectId;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  });
  const rows = computed(() => buildWbsTreeRows(wbs.value?.tasks ?? []));
  const taskCount = computed(
    () => rows.value.filter((row) => row.taskType === "TASK").length
  );
  const summaryCount = computed(
    () => rows.value.filter((row) => row.taskType === "SUMMARY").length
  );
  const milestoneCount = computed(
    () => rows.value.filter((row) => row.taskType === "MILESTONE").length
  );

  /** Project IDを検証し、WBSをBackendの最新Responseへ置き換える。 */
  const initialize = async (): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    errorMessages.value = [];
    if (projectId.value === null) {
      wbs.value = null;
      errorMessages.value = ["Project IDが不正です。"];
      return;
    }

    isLoading.value = true;
    try {
      wbs.value = await WbsApi.getWbs(projectId.value);
    } catch (error: unknown) {
      wbs.value = null;
      await handleApiError(error);
    } finally {
      isLoading.value = false;
    }
  };

  /** WBS APIのstatusを、認証状態を含む画面案内へ変換する。 */
  const handleApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      errorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      errorMessages.value = ["WBSを参照するpermissionがありません。"];
      return;
    }
    if (error.status === 404) {
      errorMessages.value = [
        "Projectが見つからないか、このProjectへ参加していません。",
      ];
      return;
    }
    errorMessages.value = ["WBSを取得できませんでした。"];
  };

  /** 現在のProject IDを保持したままTask Boardへ遷移する。 */
  const openBoard = async (): Promise<void> => {
    if (projectId.value === null) {
      return;
    }
    await router.push({
      name: "TaskBoard",
      params: { projectId: projectId.value },
    });
  };

  return {
    errorMessages,
    initialize,
    isLoading,
    milestoneCount,
    openBoard,
    projectId,
    rows,
    summaryCount,
    taskCount,
    wbs,
  };
};
