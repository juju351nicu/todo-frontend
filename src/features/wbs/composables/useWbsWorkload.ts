import { ref } from "vue";

import WbsApi from "@/features/wbs/api/wbsApi";
import type {
  TaskWorkloadDateRange,
  TaskWorkloadResponse,
} from "@/features/wbs/types/wbs";
import { resolveWbsStandardErrorMessages } from "@/features/wbs/utils/apiErrors";
import {
  buildDefaultWorkloadDateRange,
  validateTaskWorkloadDateRange,
} from "@/features/wbs/utils/taskEffortPlan";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { focusFirstEnabledElement } from "@/shared/utils/focus";

/**
 * 担当者別workload cardの部品に付ける`data-workload-control`属性の値。
 * 集計中は「集計」がdisabledになりフォーカスがbodyへ外れるため、利用者が押した後はここへ戻す。
 */
export const WORKLOAD_CONTROL = {
  /** 「集計」ボタン。 */
  submit: "submit",
} as const;

/**
 * WBS画面の担当者別workload（日別の予定・実績・稼働可能時間・過配賦）の取得状態を管理する。
 *
 * - 呼び出すAPI: `WbsApi.getTaskWorkload`（Project配下の`GET /wbs/workload`）。
 * - 集計はBackendの確定値を表示し、Frontendでは再計算しない。
 * - 日別予定・実績・稼働日例外の変更後は、各領域が`reloadTaskWorkload`で現在の期間を再取得する。
 * - 401では`context.handleUnauthorized`へ委ねる。日別予定・実績Dialog等の片付けは統括の`useWbsPage`が行う。
 *
 * @param context Project IDとSession失効処理を提供する画面共通context
 */
export const useWbsWorkload = (context: WbsPageContext) => {
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

  /**
   * 「集計」を押したときの処理。workloadを取得してから「集計」へフォーカスを戻す。
   * 初期表示や他領域の変更後の再取得（`reloadTaskWorkload`）ではフォーカスを動かさないよう、利用者の操作だけをこの関数で受ける。
   *
   * @param dateRange yyyy-MM-dd形式の集計開始日・終了日
   */
  const submitTaskWorkload = async (
    dateRange: TaskWorkloadDateRange
  ): Promise<void> => {
    await loadTaskWorkload(dateRange);
    if (!context.isSessionInvalidated()) {
      await focusFirstEnabledElement([
        `[data-workload-control="${WORKLOAD_CONTROL.submit}"]`,
      ]);
    }
  };

  /** 他領域の変更後に、利用者が最後に指定した集計期間でworkloadを再取得する。 */
  const reloadTaskWorkload = (): Promise<void> =>
    loadTaskWorkload(workloadDateRange.value);

  /** workload参照APIの失敗を検索欄の案内またはSession失効処理へ変換する。 */
  const handleWorkloadReadError = async (error: unknown): Promise<void> => {
    const result = resolveWbsStandardErrorMessages(error, {
      forbidden: DISPLAY_MESSAGES.wbs.workload.forbidden,
      notFound: DISPLAY_MESSAGES.wbs.projectNotFound,
      failed: DISPLAY_MESSAGES.wbs.workload.loadFailed,
    });
    if (result.type === "unauthorized") {
      await context.handleUnauthorized();
      return;
    }
    workloadErrorMessages.value = result.messages;
  };

  return {
    isLoadingWorkload,
    loadTaskWorkload,
    reloadTaskWorkload,
    submitTaskWorkload,
    workload,
    workloadDateRange,
    workloadErrorMessages,
  };
};
