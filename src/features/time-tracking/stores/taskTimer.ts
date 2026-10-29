import { defineStore } from "pinia";

import router from "@/app/router";
import { ROUTE_NAMES } from "@/app/router/routeNames";
import { useUserStore } from "@/features/auth/stores/user";
import TimeTrackingApi, {
  TimeTrackingApiError,
} from "@/features/time-tracking/api/timeTrackingApi";
import type {
  CurrentTaskTimerResponse,
  TaskTimer,
  TaskTimerStopResponse,
} from "@/features/time-tracking/types/timeTracking";
import {
  TIME_TRACKING_ERROR_CODE,
  TIME_TRACKING_ERROR_CODES,
} from "@/features/time-tracking/utils/apiErrors";
import { formatEffortMinutes } from "@/features/time-tracking/utils/timeTracking";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import {
  hasApiFieldError,
  resolveApiErrorMessages,
} from "@/shared/utils/apiError";

type TaskTimerMutation = "START" | "STOP" | "CANCEL";

interface TaskTimerState {
  currentTimer: TaskTimer | null;
  serverTime: string | null;
  receivedAtMilliseconds: number;
  initialized: boolean;
  isLoading: boolean;
  pendingMutation: TaskTimerMutation | null;
  errorMessages: string[];
  successMessage: string;
  lastStopResult: TaskTimerStopResponse | null;
}

/** Time Trackingの409 codeを、現在状態から再操作できる利用者向け案内へ変換する。 */
const getConflictMessage = (error: TimeTrackingApiError): string => {
  const response = error.errorResponse;
  if (
    hasApiFieldError(
      response,
      TIME_TRACKING_ERROR_CODE.timerAlreadyRunning,
      "timer"
    )
  ) {
    return DISPLAY_MESSAGES.timeTracking.conflict.alreadyRunning;
  }
  if (
    hasApiFieldError(
      response,
      TIME_TRACKING_ERROR_CODE.timerNotRunning,
      "timer"
    )
  ) {
    return DISPLAY_MESSAGES.timeTracking.conflict.notRunning;
  }
  if (
    hasApiFieldError(
      response,
      TIME_TRACKING_ERROR_CODE.timerVersionConflict,
      "version"
    )
  ) {
    return DISPLAY_MESSAGES.timeTracking.conflict.version;
  }
  if (
    hasApiFieldError(
      response,
      TIME_TRACKING_ERROR_CODE.timerDurationExceeded,
      "timer"
    )
  ) {
    return DISPLAY_MESSAGES.timeTracking.conflict.durationExceeded;
  }
  if (
    hasApiFieldError(
      response,
      TIME_TRACKING_ERROR_CODE.timerDailyLimitExceeded,
      "workDate"
    )
  ) {
    return DISPLAY_MESSAGES.timeTracking.conflict.dailyLimitExceeded;
  }
  return DISPLAY_MESSAGES.timeTracking.conflict.changed;
};

/**
 * 画面を跨ぐ本人Task Timerを保持するStore。
 * TimerはWeb Storageへ永続化せず、初期表示と競合時にBackendを正本として復元する。
 */
export const useTaskTimerStore = defineStore("taskTimer", {
  state: (): TaskTimerState => ({
    currentTimer: null,
    serverTime: null,
    receivedAtMilliseconds: 0,
    initialized: false,
    isLoading: false,
    pendingMutation: null,
    errorMessages: [],
    successMessage: "",
    lastStopResult: null,
  }),
  getters: {
    /** Timer開始・停止・取消のいずれかを実行中か判定する。 */
    isMutating: (state): boolean => state.pendingMutation !== null,
    /** 指定Taskが現在計測中か判定する。 */
    isTaskRunning:
      (state) =>
      (projectId: number, taskId: number): boolean =>
        state.currentTimer?.projectId === projectId &&
        state.currentTimer.taskId === taskId,
  },
  actions: {
    /** Backendの現在Timer Responseを受信時刻とともに共有状態へ反映する。 */
    applyCurrentResponse(response: CurrentTaskTimerResponse): void {
      this.currentTimer = response.timer;
      this.serverTime = response.serverTime;
      this.receivedAtMilliseconds = Date.now();
      this.initialized = true;
    },
    /** 表示済みの成功・エラー案内だけを破棄する。 */
    clearMessages(): void {
      this.errorMessages = [];
      this.successMessage = "";
    },
    /** ログアウト後に別利用者へTimer情報を引き継がないようメモリー状態を破棄する。 */
    resetForLogout(): void {
      this.currentTimer = null;
      this.serverTime = null;
      this.receivedAtMilliseconds = 0;
      this.initialized = false;
      this.isLoading = false;
      this.pendingMutation = null;
      this.errorMessages = [];
      this.successMessage = "";
      this.lastStopResult = null;
    },
    /**
     * 認証Session復元後の初回だけ現在TimerをBackendから取得する。
     * ログイン画面と共通レイアウトの切替でAppHeaderが再生成されても、定期pollingや重複取得を行わない。
     */
    async initialize(): Promise<void> {
      if (this.initialized || this.isLoading) {
        return;
      }
      await this.refreshCurrent();
    },
    /** Backendを正本として現在Timerを再取得する。 */
    async refreshCurrent(showLoading = true): Promise<boolean> {
      if (this.isLoading) {
        return false;
      }
      if (showLoading) {
        this.isLoading = true;
      }
      try {
        this.applyCurrentResponse(await TimeTrackingApi.getCurrentTimer());
        return true;
      } catch (error: unknown) {
        await this.handleApiError(
          error,
          DISPLAY_MESSAGES.timeTracking.currentLoadFailed,
          false
        );
        return false;
      } finally {
        if (showLoading) {
          this.isLoading = false;
        }
      }
    },
    /**
     * 指定Taskで本人Timerを開始する。
     * 現在Timerがある場合はAPIを呼ばず、複数tabの409ではBackend状態を再取得する。
     */
    async startTimer(projectId: number, taskId: number): Promise<boolean> {
      if (this.pendingMutation !== null) {
        return false;
      }
      this.clearMessages();
      if (this.currentTimer !== null) {
        this.errorMessages = [
          this.isTaskRunning(projectId, taskId)
            ? "このTaskはすでに計測中です。"
            : `「${this.currentTimer.taskTitle}」を計測中です。停止または取消してから開始してください。`,
        ];
        return false;
      }

      this.pendingMutation = "START";
      try {
        this.applyCurrentResponse(
          await TimeTrackingApi.startTimer(projectId, taskId)
        );
        this.successMessage = "TaskのTimerを開始しました。";
        return true;
      } catch (error: unknown) {
        await this.handleApiError(
          error,
          DISPLAY_MESSAGES.timeTracking.startFailed,
          true
        );
        return false;
      } finally {
        this.pendingMutation = null;
      }
    },
    /** 現在Timerを停止し、Backendが確定した日別実績への加算結果を案内する。 */
    async stopCurrentTimer(): Promise<boolean> {
      const timer = this.currentTimer;
      if (this.pendingMutation !== null || timer === null) {
        if (timer === null) {
          this.errorMessages = ["停止できるTimerはありません。"];
        }
        return false;
      }

      this.clearMessages();
      this.pendingMutation = "STOP";
      try {
        const result = await TimeTrackingApi.stopCurrentTimer({
          version: timer.version,
        });
        this.currentTimer = null;
        this.serverTime = result.serverTime;
        this.receivedAtMilliseconds = Date.now();
        this.initialized = true;
        this.lastStopResult = result;
        const creditedMinutes = result.allocations.reduce(
          (total, allocation) => total + allocation.creditedMinutes,
          0
        );
        this.successMessage =
          creditedMinutes === 0
            ? "Timerを停止しました。60秒未満の累積分は日別実績へまだ加算されません。"
            : `Timerを停止し、日別実績へ${formatEffortMinutes(creditedMinutes)}加算しました。`;
        return true;
      } catch (error: unknown) {
        await this.handleApiError(
          error,
          DISPLAY_MESSAGES.timeTracking.stopFailed,
          true
        );
        return false;
      } finally {
        this.pendingMutation = null;
      }
    },
    /** 現在Timerを日別実績へ反映せず取消する。 */
    async cancelCurrentTimer(): Promise<boolean> {
      const timer = this.currentTimer;
      if (this.pendingMutation !== null || timer === null) {
        if (timer === null) {
          this.errorMessages = ["取消できるTimerはありません。"];
        }
        return false;
      }

      this.clearMessages();
      this.pendingMutation = "CANCEL";
      try {
        this.applyCurrentResponse(
          await TimeTrackingApi.cancelCurrentTimer({ version: timer.version })
        );
        this.successMessage = "Timerを実績へ反映せず取消しました。";
        return true;
      } catch (error: unknown) {
        await this.handleApiError(
          error,
          DISPLAY_MESSAGES.timeTracking.cancelFailed,
          true
        );
        return false;
      } finally {
        this.pendingMutation = null;
      }
    },
    /** API失敗をSession破棄、競合再取得または画面案内へ変換する。 */
    async handleApiError(
      error: unknown,
      fallbackMessage: string,
      refreshOnConflict: boolean
    ): Promise<void> {
      if (!(error instanceof TimeTrackingApiError)) {
        this.errorMessages = [DISPLAY_MESSAGES.common.connectionFailed];
        return;
      }
      if (error.status === 401) {
        // Timerはヘッダー・Task Dialog・My Tasksの複数の画面から同じStoreを使うため、401の後始末とLoginへの遷移を
        // 呼出側ごとに書かず、ここで1回だけ行う。Storeのactionでは`useRouter`（`useSessionExpiry`）を使えないため、
        // routerのインスタンスで遷移する。
        this.resetForLogout();
        const userStore = useUserStore();
        userStore.clearSession();
        await router.push({ name: ROUTE_NAMES.login });
        return;
      }
      if (error.status === 409) {
        const conflictMessage = getConflictMessage(error);
        if (refreshOnConflict) {
          const refreshed = await this.refreshCurrent(false);
          if (!refreshed) {
            return;
          }
        }
        this.errorMessages = [conflictMessage];
        return;
      }
      if (error.status === 403) {
        this.errorMessages = [
          DISPLAY_MESSAGES.timeTracking.operationForbidden,
        ];
        return;
      }
      if (error.status === 404) {
        this.errorMessages = [DISPLAY_MESSAGES.timeTracking.resourceNotFound];
        return;
      }
      this.errorMessages = resolveApiErrorMessages(
        error.errorResponse,
        TIME_TRACKING_ERROR_CODES,
        fallbackMessage
      );
    },
  },
});
