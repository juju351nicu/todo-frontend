import { storeToRefs } from "pinia";
import { computed, onScopeDispose, ref, watch } from "vue";

import { useUserStore } from "@/features/auth/stores/user";
import { useTaskTimerStore } from "@/features/time-tracking/stores/taskTimer";
import {
  calculateDisplayedElapsedSeconds,
  formatElapsedSeconds,
} from "@/features/time-tracking/utils/timeTracking";

const ELAPSED_REFRESH_MILLISECONDS = 1_000;

/**
 * ヘッダーに表示する現在Timerの状態と操作を提供する。
 *
 * - Timerの正本は`useTaskTimerStore`（Backendの現在Timer）であり、ここでは表示用の経過時間だけを1秒ごとに再計算する。
 *   Backend pollingやTimerの自動停止は行わない。
 * - 認証状態を監視し、ログイン済みになったら現在Timerを1回取得し、ログアウトしたらStoreを初期化する。
 * - 1秒ごとのtimerは、呼び出したComponentの破棄（effect scopeの終了）で停止する。Componentの`setup`内から呼び出すこと。
 */
export const useCurrentTaskTimer = () => {
  const userStore = useUserStore();
  const timerStore = useTaskTimerStore();
  const { currentTimer, errorMessages, isLoading, pendingMutation, receivedAtMilliseconds, successMessage } =
    storeToRefs(timerStore);

  /** 取消確認dialogを開いている場合はtrue。 */
  const isCancelConfirmOpen = ref<boolean>(false);
  const nowMilliseconds = ref<number>(Date.now());

  /** HH:mm:ss形式の経過時間。現在Timerがない場合は`00:00:00`。 */
  const displayedElapsed = computed<string>(() =>
    currentTimer.value === null
      ? "00:00:00"
      : formatElapsedSeconds(
          calculateDisplayedElapsedSeconds(
            currentTimer.value.elapsedSeconds,
            receivedAtMilliseconds.value,
            nowMilliseconds.value,
          ),
        ),
  );

  /** 現在Timerを停止して日別実績へ反映し、取消確認が開いていれば閉じる。 */
  const stopTimer = async (): Promise<void> => {
    isCancelConfirmOpen.value = false;
    await timerStore.stopCurrentTimer();
  };

  /** 確認済みの現在Timerを実績へ反映せず取消する。失敗した場合は確認dialogを開いたまま再操作できるようにする。 */
  const cancelTimer = async (): Promise<void> => {
    const canceled = await timerStore.cancelCurrentTimer();
    if (canceled) {
      isCancelConfirmOpen.value = false;
    }
  };

  /** 通知を閉じた場合に、Storeが保持する一時メッセージを破棄する。 */
  const handleMessageVisibility = (visible: boolean): void => {
    if (!visible) {
      timerStore.clearMessages();
    }
  };

  watch(
    () => userStore.isAuthenticated,
    (authenticated) => {
      if (authenticated) {
        void timerStore.initialize();
      } else {
        timerStore.resetForLogout();
      }
    },
    { immediate: true },
  );

  const elapsedTimer = setInterval(() => {
    nowMilliseconds.value = Date.now();
  }, ELAPSED_REFRESH_MILLISECONDS);
  onScopeDispose(() => clearInterval(elapsedTimer));

  return {
    cancelTimer,
    currentTimer,
    displayedElapsed,
    errorMessages,
    handleMessageVisibility,
    isCancelConfirmOpen,
    isLoading,
    pendingMutation,
    stopTimer,
    successMessage,
  };
};
