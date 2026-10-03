import { defineStore } from "pinia";

import router from "@/app/router";
import { useUserStore } from "@/features/auth/stores/user";
import TimeTrackingApi, {
  TimeTrackingApiError,
} from "@/features/time-tracking/api/timeTrackingApi";
import type {
  CurrentTaskTimerResponse,
  TaskTimer,
  TaskTimerStopResponse,
} from "@/features/time-tracking/types/timeTracking";
import { formatEffortMinutes } from "@/features/time-tracking/utils/timeTracking";

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

/** Backendの先頭field error codeを取得する。 */
const getErrorCode = (error: TimeTrackingApiError): string | null =>
  error.errorResponse?.fieldErrors?.[0]?.errorCode ?? null;

/** Backendが返したfield error messageを空文字を除いて取得する。 */
const getFieldErrorMessages = (error: TimeTrackingApiError): string[] =>
  (error.errorResponse?.fieldErrors ?? [])
    .map((fieldError) => fieldError.message?.trim())
    .filter((message): message is string => Boolean(message));

/** Time Trackingの409 codeを、現在状態から再操作できる利用者向け案内へ変換する。 */
const getConflictMessage = (error: TimeTrackingApiError): string => {
  const code = getErrorCode(error);
  return (
    {
      TASK_TIMER_ALREADY_RUNNING:
        "別の画面またはタブでTimerが開始されています。現在Timerを再取得しました。",
      TASK_TIMER_NOT_RUNNING:
        "Timerはすでに停止または取消されています。現在状態を再取得しました。",
      TASK_TIMER_VERSION_CONFLICT:
        "Timerが別の操作で更新されました。現在状態を再取得しました。",
      TASK_TIMER_DURATION_EXCEEDED:
        "連続24時間を超えているため停止できません。Timerを取消し、正しい工数を手入力してください。",
      TASK_TIMER_DAILY_LIMIT_EXCEEDED:
        "日別実績が1440分を超えるため停止できません。Timerを取消し、正しい工数を手入力してください。",
    }[code ?? ""] ??
    "Timerの状態が別の操作で変更されました。現在状態を再取得しました。"
  );
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
     * route変更でAppHeaderが再生成されても定期pollingや重複取得を行わない。
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
        await this.handleApiError(error, "現在Timerを取得できませんでした。", false);
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
        await this.handleApiError(error, "TaskのTimerを開始できませんでした。", true);
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
        await this.handleApiError(error, "Timerを停止できませんでした。", true);
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
        await this.handleApiError(error, "Timerを取消できませんでした。", true);
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
        this.errorMessages = ["Backendへ接続できませんでした。"];
        return;
      }
      if (error.status === 401) {
        this.resetForLogout();
        const userStore = useUserStore();
        userStore.clearSession();
        await router.push({ name: "Login" });
        return;
      }
      if (error.status === 409) {
        const conflictMessage = getConflictMessage(error);
        if (refreshOnConflict) {
          await this.refreshCurrent(false);
        }
        this.errorMessages = [conflictMessage];
        return;
      }
      const fieldMessages = getFieldErrorMessages(error);
      if (fieldMessages.length > 0) {
        this.errorMessages = fieldMessages;
        return;
      }
      if (error.status === 403) {
        this.errorMessages = ["このTaskでTimerを操作する権限がありません。"];
        return;
      }
      if (error.status === 404) {
        this.errorMessages = ["対象のProjectまたはTaskが見つかりません。"];
        return;
      }
      this.errorMessages = [fallbackMessage];
    },
  },
});
