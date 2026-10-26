import { storeToRefs } from "pinia";
import { computed, toValue } from "vue";
import type { MaybeRefOrGetter } from "vue";

import { useTaskTimerStore } from "@/features/time-tracking/stores/taskTimer";

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
    timerStore.isTaskRunning(toValue(target.projectId), toValue(target.taskId)),
  );
  /** 対象以外のTaskで現在Timerが計測中の場合はtrue。 */
  const isAnotherTaskRunning = computed<boolean>(() => currentTimer.value !== null && !isThisTaskRunning.value);
  const isDisabled = computed<boolean>(
    () =>
      toValue(target.disabled ?? false) ||
      !initialized.value ||
      isLoading.value ||
      pendingMutation.value !== null ||
      isAnotherTaskRunning.value,
  );

  /** 対象TaskのTimerを開始する。 */
  const startTimer = async (): Promise<void> => {
    await timerStore.startTimer(toValue(target.projectId), toValue(target.taskId));
  };

  /** 対象Taskで実行中の現在Timerを停止し、日別実績へ反映する。 */
  const stopTimer = async (): Promise<void> => {
    await timerStore.stopCurrentTimer();
  };

  return {
    currentTimer,
    isAnotherTaskRunning,
    isDisabled,
    isThisTaskRunning,
    pendingMutation,
    startTimer,
    stopTimer,
  };
};
