import { storeToRefs } from "pinia";
import { computed, toValue } from "vue";
import type { MaybeRefOrGetter } from "vue";

import { useTaskTimerStore } from "@/features/time-tracking/stores/taskTimer";
import { focusFirstEnabledElement } from "@/shared/utils/focus";

/**
 * Timer開始／停止buttonに付ける`data-task-timer-action`属性の値を組み立てる。
 * `TaskTimerActionButton.vue`はこの値で属性を付け、`useTaskTimerAction`は操作後に同じ値でbuttonを探してフォーカスを戻す。
 *
 * @param projectId Timer対象Project ID
 * @param taskId Timer対象Task ID
 * @returns `"{projectId}:{taskId}"`形式の属性値
 */
export const buildTaskTimerActionKey = (projectId: number, taskId: number): string =>
  `${projectId}:${taskId}`;

/** `useTaskTimerAction`の対象Taskと事前の無効化条件。 */
export interface TaskTimerActionTarget {
  /** Timer対象Project ID。 */
  projectId: MaybeRefOrGetter<number>;
  /** Board・WBSと共通の通常Task ID。 */
  taskId: MaybeRefOrGetter<number>;
  /** Backend認可の事前案内として操作を無効化する場合はtrue。 */
  disabled?: MaybeRefOrGetter<boolean>;
}

/**
 * Board・WBSのTask行に置くTimer開始／停止buttonの状態と操作を提供する。
 *
 * 現在Timerの正本は`useTaskTimerStore`であり、同時に計測できるTimerは1件だけである。
 * 別Taskを計測中、Store未初期化、取得中、他の更新操作中はbuttonを無効にする。最終的な可否はBackendが判定する。
 */
export const useTaskTimerAction = (target: TaskTimerActionTarget) => {
  const timerStore = useTaskTimerStore();
  const { currentTimer, initialized, isLoading, pendingMutation } = storeToRefs(timerStore);

  /** 対象Taskで現在Timerが計測中の場合はtrue。 */
  const isThisTaskRunning = computed<boolean>(() =>
    timerStore.isTaskRunning(toValue(target.projectId), toValue(target.taskId))
  );
  /** 対象以外のTaskで現在Timerが計測中の場合はtrue。 */
  const isAnotherTaskRunning = computed<boolean>(
    () => currentTimer.value !== null && !isThisTaskRunning.value
  );
  const isDisabled = computed<boolean>(
    () =>
      toValue(target.disabled ?? false) ||
      !initialized.value ||
      isLoading.value ||
      pendingMutation.value !== null ||
      isAnotherTaskRunning.value
  );

  /** 対象Taskのbuttonへ付ける`data-task-timer-action`属性の値。 */
  const actionKey = computed<string>(() =>
    buildTaskTimerActionKey(toValue(target.projectId), toValue(target.taskId))
  );

  /**
   * 開始・停止の後（失敗した場合も含む）、同じTaskのbuttonへフォーカスを戻す。
   * 開始と停止で別のbuttonへ切り替わり、更新中はdisabledにもなるため、押したbuttonからフォーカスが外れて
   * キーボードだけでは続けて停止できなくなる。切り替わった後のbuttonを属性で探し直す。
   */
  const restoreActionFocus = (): Promise<void> =>
    focusFirstEnabledElement([`[data-task-timer-action="${actionKey.value}"]`]);

  /** 対象TaskのTimerを開始し、同じTaskのbutton（停止button）へフォーカスを戻す。 */
  const startTimer = async (): Promise<void> => {
    await timerStore.startTimer(toValue(target.projectId), toValue(target.taskId));
    await restoreActionFocus();
  };

  /** 対象Taskで実行中の現在Timerを停止して日別実績へ反映し、同じTaskのbutton（開始button）へフォーカスを戻す。 */
  const stopTimer = async (): Promise<void> => {
    await timerStore.stopCurrentTimer();
    await restoreActionFocus();
  };

  return {
    actionKey,
    currentTimer,
    isAnotherTaskRunning,
    isDisabled,
    isThisTaskRunning,
    pendingMutation,
    startTimer,
    stopTimer,
  };
};
