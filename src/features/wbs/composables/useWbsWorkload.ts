import { ref } from "vue";

import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type {
  TaskWorkloadDateRange,
  TaskWorkloadResponse,
} from "@/features/wbs/types/wbs";
import { resolveWbsErrorMessages } from "@/features/wbs/utils/apiErrors";
import {
  buildDefaultWorkloadDateRange,
  validateTaskWorkloadDateRange,
} from "@/features/wbs/utils/taskEffortPlan";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

/** `useWbsWorkload`が画面の他領域へ委ねる操作。 */
export interface UseWbsWorkloadOptions {
  /**
   * workload参照が401になったとき、Session破棄の前に呼ぶ。
   * workloadは日別予定・実績の保存後にも再取得されるため、それらのDialogに古いversionを残さないよう閉じる。
   */
  readonly closeDialogsOnUnauthorized: () => void;
}

/**
 * WBS画面の担当者別workload（日別の予定・実績・稼働可能時間・過配賦）の取得状態を管理する。
 *
 * - 呼び出すAPI: `WbsApi.getTaskWorkload`（Project配下の`GET /wbs/workload`）。
 * - 集計はBackendの確定値を表示し、Frontendでは再計算しない。
 * - 日別予定・実績・稼働日例外の変更後は、各領域が`reloadTaskWorkload`で現在の期間を再取得する。
 * - 401では`closeDialogsOnUnauthorized`の後に`context.handleUnauthorized`でLoginへ遷移する。
 *
 * @param context Project IDとSession失効処理を提供する画面共通context
 * @param options 401時に閉じる他領域のDialog
 */
export const useWbsWorkload = (
  context: WbsPageContext,
  options: UseWbsWorkloadOptions
) => {
  /** 最後に取得成功したworkload。取得失敗時も直前の確定値を残し、初期表示の失敗時だけ画面側でnullへ戻す。 */
  const workload = ref<TaskWorkloadResponse | null>(null);
  /** 最後に取得を開始した集計期間。初期値はブラウザー現在月の初日・末日。 */
  const workloadDateRange = ref<TaskWorkloadDateRange>(
    buildDefaultWorkloadDateRange()
  );
  const workloadErrorMessages = ref<string[]>([]);
  const isLoadingWorkload = ref(false);

  /**
   * 指定期間のProject workloadを検証・取得し、予定・実績比較の確定表示へ反映する。
   * 取得中の再実行と期間不正ではAPIを呼ばない。
   *
   * @param dateRange yyyy-MM-dd形式の集計開始日・終了日（最大366日）
   */
  const loadTaskWorkload = async (
    dateRange: TaskWorkloadDateRange
  ): Promise<void> => {
    const projectId = context.projectId.value;
    if (projectId === null || isLoadingWorkload.value) {
      return;
    }
    const validationMessages = validateTaskWorkloadDateRange(dateRange);
    if (validationMessages.length > 0) {
      workloadErrorMessages.value = validationMessages;
      return;
    }

    isLoadingWorkload.value = true;
    workloadErrorMessages.value = [];
    workloadDateRange.value = { ...dateRange };
    try {
      workload.value = await WbsApi.getTaskWorkload(
        projectId,
        dateRange.dateFrom,
        dateRange.dateTo
      );
    } catch (error: unknown) {
      await handleWorkloadReadError(error);
    } finally {
      isLoadingWorkload.value = false;
    }
  };

  /** 他領域の変更後に、利用者が最後に指定した集計期間でworkloadを再取得する。 */
  const reloadTaskWorkload = (): Promise<void> =>
    loadTaskWorkload(workloadDateRange.value);

  /** workload参照APIのstatusを検索欄の案内またはSession動作へ変換する。 */
  const handleWorkloadReadError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      workloadErrorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      options.closeDialogsOnUnauthorized();
      await context.handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      workloadErrorMessages.value = [DISPLAY_MESSAGES.wbs.workload.forbidden];
      return;
    }
    if (error.status === 404) {
      workloadErrorMessages.value = [DISPLAY_MESSAGES.wbs.projectNotFound];
      return;
    }
    workloadErrorMessages.value = resolveWbsErrorMessages(
      error,
      DISPLAY_MESSAGES.wbs.workload.loadFailed
    );
  };

  return {
    isLoadingWorkload,
    loadTaskWorkload,
    reloadTaskWorkload,
    workload,
    workloadDateRange,
    workloadErrorMessages,
  };
};
