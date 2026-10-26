import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, reactive } from "vue";

import { useCurrentTaskTimer } from "@/features/time-tracking/composables/useCurrentTaskTimer";
import { useTaskTimerStore } from "@/features/time-tracking/stores/taskTimer";

const mocks = vi.hoisted(() => ({
  userStore: null,
}));

vi.mock("@/app/router", () => ({ default: { push: vi.fn() } }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

const timer = {
  timerSessionId: 101,
  projectId: 12,
  projectKey: "WORK",
  projectName: "Work Management",
  taskId: 345,
  taskTitle: "Timer UI",
  startedAt: "2026-10-03T09:30:00+09:00",
  elapsedSeconds: 1800,
  version: 2,
};

/** effect scope内でcomposableを生成し、Component破棄に相当するstopを呼べるようにする。 */
const setUp = () => {
  const scope = effectScope();
  const currentTaskTimer = scope.run(() => useCurrentTaskTimer());
  return { currentTaskTimer, scope };
};

describe("useCurrentTaskTimer", () => {
  let timerStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T10:00:00+09:00"));
    setActivePinia(createPinia());
    mocks.userStore = reactive({ isAuthenticated: false });
    timerStore = useTaskTimerStore();
    vi.spyOn(timerStore, "initialize").mockResolvedValue(undefined);
    vi.spyOn(timerStore, "resetForLogout");
    vi.spyOn(timerStore, "stopCurrentTimer").mockResolvedValue(true);
    vi.spyOn(timerStore, "clearMessages");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("現在Timerがない場合は00:00:00を表示する", () => {
    const { currentTaskTimer, scope } = setUp();

    expect(currentTaskTimer.displayedElapsed.value).toBe("00:00:00");
    scope.stop();
  });

  it("Backendの経過秒数へ受信後の経過時間を1秒ごとに加算して表示する", () => {
    mocks.userStore.isAuthenticated = true;
    timerStore.currentTimer = timer;
    timerStore.receivedAtMilliseconds = Date.now();
    const { currentTaskTimer, scope } = setUp();

    expect(currentTaskTimer.displayedElapsed.value).toBe("00:30:00");
    vi.advanceTimersByTime(2_000);
    expect(currentTaskTimer.displayedElapsed.value).toBe("00:30:02");
    scope.stop();
  });

  it("未認証の初期状態ではStoreを初期化し、ログイン後に現在Timerを取得する", async () => {
    const { scope } = setUp();
    expect(timerStore.resetForLogout).toHaveBeenCalledTimes(1);
    expect(timerStore.initialize).not.toHaveBeenCalled();

    mocks.userStore.isAuthenticated = true;
    await nextTick();

    expect(timerStore.initialize).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("停止時は取消確認を閉じてStoreの停止を呼ぶ", async () => {
    const { currentTaskTimer, scope } = setUp();
    currentTaskTimer.isCancelConfirmOpen.value = true;

    await currentTaskTimer.stopTimer();

    expect(currentTaskTimer.isCancelConfirmOpen.value).toBe(false);
    expect(timerStore.stopCurrentTimer).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("取消に失敗した場合は確認dialogを開いたままにする", async () => {
    vi.spyOn(timerStore, "cancelCurrentTimer").mockResolvedValue(false);
    const { currentTaskTimer, scope } = setUp();
    currentTaskTimer.isCancelConfirmOpen.value = true;

    await currentTaskTimer.cancelTimer();

    expect(currentTaskTimer.isCancelConfirmOpen.value).toBe(true);
    scope.stop();
  });

  it("取消に成功した場合は確認dialogを閉じる", async () => {
    vi.spyOn(timerStore, "cancelCurrentTimer").mockResolvedValue(true);
    const { currentTaskTimer, scope } = setUp();
    currentTaskTimer.isCancelConfirmOpen.value = true;

    await currentTaskTimer.cancelTimer();

    expect(currentTaskTimer.isCancelConfirmOpen.value).toBe(false);
    scope.stop();
  });

  it("通知を閉じたときだけ一時メッセージを破棄する", () => {
    const { currentTaskTimer, scope } = setUp();

    currentTaskTimer.handleMessageVisibility(true);
    expect(timerStore.clearMessages).not.toHaveBeenCalled();
    currentTaskTimer.handleMessageVisibility(false);
    expect(timerStore.clearMessages).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("Component破棄に相当するscope終了後は経過表示timerを残さない", () => {
    const { scope } = setUp();

    scope.stop();

    expect(vi.getTimerCount()).toBe(0);
  });
});
