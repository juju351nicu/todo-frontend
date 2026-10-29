import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { TimeTrackingApiError } from "@/features/time-tracking/api/timeTrackingApi";
import { useTaskTimerStore } from "@/features/time-tracking/stores/taskTimer";

const mocks = vi.hoisted(() => ({
  api: {
    cancelCurrentTimer: vi.fn(),
    getCurrentTimer: vi.fn(),
    startTimer: vi.fn(),
    stopCurrentTimer: vi.fn(),
  },
  router: { push: vi.fn() },
  userStore: { clearSession: vi.fn() },
}));

vi.mock("@/app/router", () => ({ default: mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/time-tracking/api/timeTrackingApi", async () => {
  const actual = await vi.importActual("@/features/time-tracking/api/timeTrackingApi");
  return { ...actual, default: mocks.api };
});

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

const currentResponse = {
  serverTime: "2026-10-03T10:00:00+09:00",
  timer,
};

describe("useTaskTimerStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    mocks.router.push.mockResolvedValue(undefined);
    mocks.api.getCurrentTimer.mockResolvedValue(currentResponse);
    mocks.api.startTimer.mockResolvedValue(currentResponse);
    mocks.api.cancelCurrentTimer.mockResolvedValue({
      serverTime: "2026-10-03T10:10:00+09:00",
      timer: null,
    });
    mocks.api.stopCurrentTimer.mockResolvedValue({
      serverTime: "2026-10-03T10:30:00+09:00",
      session: {
        ...timer,
        statusCode: "STOPPED",
        stoppedAt: "2026-10-03T10:30:00+09:00",
        durationSeconds: 3600,
        version: 3,
      },
      allocations: [
        {
          workDate: "2026-10-03",
          elapsedSeconds: 3600,
          creditedMinutes: 60,
          workLogId: 91,
          actualEffortMinutes: 120,
        },
      ],
    });
  });

  it("初期表示では現在Timerを1回だけ取得してroute変更の重複取得を防ぐ", async () => {
    const store = useTaskTimerStore();

    await store.initialize();
    await store.initialize();

    expect(mocks.api.getCurrentTimer).toHaveBeenCalledOnce();
    expect(store.currentTimer).toEqual(timer);
    expect(store.initialized).toBe(true);
  });

  it("Timer未実行時だけ指定Taskを開始する", async () => {
    mocks.api.getCurrentTimer.mockResolvedValue({
      serverTime: "2026-10-03T10:00:00+09:00",
      timer: null,
    });
    const store = useTaskTimerStore();
    await store.initialize();

    await expect(store.startTimer(12, 345)).resolves.toBe(true);

    expect(mocks.api.startTimer).toHaveBeenCalledWith(12, 345);
    expect(store.currentTimer).toEqual(timer);
  });

  it("現在Timerがある場合は別Taskの開始APIを呼ばない", async () => {
    const store = useTaskTimerStore();
    store.applyCurrentResponse(currentResponse);

    await expect(store.startTimer(12, 999)).resolves.toBe(false);

    expect(mocks.api.startTimer).not.toHaveBeenCalled();
    expect(store.errorMessages[0]).toContain("Timer UI");
  });

  it("停止時は取得済みversionを送り日別実績への加算分を案内する", async () => {
    const store = useTaskTimerStore();
    store.applyCurrentResponse(currentResponse);

    await expect(store.stopCurrentTimer()).resolves.toBe(true);

    expect(mocks.api.stopCurrentTimer).toHaveBeenCalledWith({ version: 2 });
    expect(store.currentTimer).toBeNull();
    expect(store.lastStopResult?.allocations[0].creditedMinutes).toBe(60);
    expect(store.successMessage).toContain("1時間");
  });

  it("60秒未満の停止では0分を実績未反映として案内する", async () => {
    mocks.api.stopCurrentTimer.mockResolvedValue({
      serverTime: "2026-10-03T10:00:59+09:00",
      session: {
        ...timer,
        statusCode: "STOPPED",
        stoppedAt: "2026-10-03T10:00:59+09:00",
        durationSeconds: 59,
        version: 3,
      },
      allocations: [
        {
          workDate: "2026-10-03",
          elapsedSeconds: 59,
          creditedMinutes: 0,
          workLogId: null,
          actualEffortMinutes: null,
        },
      ],
    });
    const store = useTaskTimerStore();
    store.applyCurrentResponse(currentResponse);

    await store.stopCurrentTimer();

    expect(store.successMessage).toContain("60秒未満");
  });

  it("409競合ではFrontend状態を捨てて現在Timerを再取得する", async () => {
    let completeRefresh;
    mocks.api.getCurrentTimer.mockImplementation(
      () =>
        new Promise((resolve) => {
          completeRefresh = resolve;
        })
    );
    mocks.api.startTimer.mockRejectedValue(
      new TimeTrackingApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_TIMER_ALREADY_RUNNING",
            field: "timer",
            message: "Timerはすでに実行中です。",
          },
        ],
      })
    );
    const store = useTaskTimerStore();
    store.applyCurrentResponse({
      serverTime: "2026-10-03T10:00:00+09:00",
      timer: null,
    });

    const result = store.startTimer(12, 345);

    await vi.waitFor(() => {
      expect(mocks.api.getCurrentTimer).toHaveBeenCalledOnce();
    });
    expect(store.errorMessages).toEqual([]);
    completeRefresh(currentResponse);
    await expect(result).resolves.toBe(false);

    expect(store.currentTimer).toEqual(timer);
    expect(store.errorMessages).toEqual([
      "別の画面またはタブでTimerが開始されています。現在Timerを再取得しました。",
    ]);
  });

  it("409のcodeとfieldが契約不一致でも再取得後に固定fallbackを表示する", async () => {
    mocks.api.startTimer.mockRejectedValue(
      new TimeTrackingApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_TIMER_VERSION_CONFLICT",
            field: "timer",
            message: "表示してはいけない未契約の組み合わせです。",
          },
        ],
      })
    );
    const store = useTaskTimerStore();
    store.applyCurrentResponse({
      serverTime: "2026-10-03T10:00:00+09:00",
      timer: null,
    });

    await store.startTimer(12, 345);

    expect(mocks.api.getCurrentTimer).toHaveBeenCalledOnce();
    expect(store.errorMessages).toEqual([
      "Timerの状態が別の操作で変更されました。現在状態を再取得しました。",
    ]);
  });

  it.each([
    [
      "TASK_TIMER_NOT_RUNNING",
      "timer",
      "Timerはすでに停止または取消されています。現在状態を再取得しました。",
    ],
    [
      "TASK_TIMER_VERSION_CONFLICT",
      "version",
      "Timerが別の操作で更新されました。現在状態を再取得しました。",
    ],
    [
      "TASK_TIMER_DURATION_EXCEEDED",
      "timer",
      "連続24時間を超えているため停止できません。Timerを取消し、正しい工数を手入力してください。",
    ],
    [
      "TASK_TIMER_DAILY_LIMIT_EXCEEDED",
      "workDate",
      "日別実績が1440分を超えるため停止できません。Timerを取消し、正しい工数を手入力してください。",
    ],
  ])("409の%sとfieldを固定案内へ変換する", async (code, field, message) => {
    const store = useTaskTimerStore();

    await store.handleApiError(
      new TimeTrackingApiError(409, {
        fieldErrors: [{ errorCode: code, field, message: "locale依存文言" }],
      }),
      "操作に失敗しました。",
      false
    );

    expect(store.errorMessages).toEqual([message]);
  });

  it("409後の再取得で401になった場合は競合案内を残さずSessionを破棄する", async () => {
    mocks.api.startTimer.mockRejectedValue(
      new TimeTrackingApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_TIMER_ALREADY_RUNNING",
            field: "timer",
            message: "Timerはすでに実行中です。",
          },
        ],
      })
    );
    mocks.api.getCurrentTimer.mockRejectedValue(new TimeTrackingApiError(401, null));
    const store = useTaskTimerStore();

    await store.startTimer(12, 345);

    expect(store.initialized).toBe(false);
    expect(store.currentTimer).toBeNull();
    expect(store.errorMessages).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("409後の再取得が通信失敗した場合は再取得済みと案内しない", async () => {
    mocks.api.startTimer.mockRejectedValue(
      new TimeTrackingApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_TIMER_ALREADY_RUNNING",
            field: "timer",
            message: "Timerはすでに実行中です。",
          },
        ],
      })
    );
    mocks.api.getCurrentTimer.mockRejectedValue(new TypeError("network error"));
    const store = useTaskTimerStore();
    store.applyCurrentResponse({
      serverTime: "2026-10-03T10:00:00+09:00",
      timer: null,
    });

    await store.startTimer(12, 345);

    expect(store.errorMessages).toEqual(["Backendへ接続できませんでした。"]);
    expect(store.errorMessages[0]).not.toContain("再取得しました");
  });

  it("契約済み400の複数messageをBackend順で表示する", async () => {
    mocks.api.startTimer.mockRejectedValue(
      new TimeTrackingApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_TASK_TIMER_REQUEST",
            field: "projectId",
            message: " Project IDを確認してください。 ",
          },
          {
            errorCode: "INVALID_TASK_TIMER_REQUEST",
            field: "taskId",
            message: "Task IDを確認してください。",
          },
        ],
      })
    );
    const store = useTaskTimerStore();

    await store.startTimer(12, 345);

    expect(store.errorMessages).toEqual([
      "Project IDを確認してください。",
      "Task IDを確認してください。",
    ]);
  });

  it("未知codeのBackend messageを表示せず操作別fallbackへ閉じる", async () => {
    mocks.api.startTimer.mockRejectedValue(
      new TimeTrackingApiError(400, {
        fieldErrors: [
          {
            errorCode: "UNKNOWN_TIMER_ERROR",
            field: "request",
            message: "内部情報を含み得る未契約文言",
          },
        ],
      })
    );
    const store = useTaskTimerStore();

    await store.startTimer(12, 345);

    expect(store.errorMessages).toEqual(["TaskのTimerを開始できませんでした。"]);
    expect(mocks.api.getCurrentTimer).not.toHaveBeenCalled();
  });

  it("本文なし403ではSessionを維持してTimer操作の権限不足を表示する", async () => {
    mocks.api.stopCurrentTimer.mockRejectedValue(new TimeTrackingApiError(403, null));
    const store = useTaskTimerStore();
    store.applyCurrentResponse(currentResponse);

    await store.stopCurrentTimer();

    expect(store.errorMessages).toEqual(["このTaskでTimerを操作する権限がありません。"]);
    expect(store.currentTimer).toEqual(timer);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("404ではBackend本文に依存せず対象なしを表示する", async () => {
    mocks.api.cancelCurrentTimer.mockRejectedValue(
      new TimeTrackingApiError(404, {
        fieldErrors: [
          {
            errorCode: "TASK_NOT_FOUND",
            field: "taskId",
            message: "localeで変化する対象なし文言",
          },
        ],
      })
    );
    const store = useTaskTimerStore();
    store.applyCurrentResponse(currentResponse);

    await store.cancelCurrentTimer();

    expect(store.errorMessages).toEqual(["対象のProjectまたはTaskが見つかりません。"]);
  });

  it("取消は実績を作らず現在Timerをnullへ更新する", async () => {
    const store = useTaskTimerStore();
    store.applyCurrentResponse(currentResponse);

    await expect(store.cancelCurrentTimer()).resolves.toBe(true);

    expect(mocks.api.cancelCurrentTimer).toHaveBeenCalledWith({ version: 2 });
    expect(store.currentTimer).toBeNull();
  });

  it("401ではTimerとSession表示を破棄してLoginへ戻す", async () => {
    mocks.api.getCurrentTimer.mockRejectedValue(new TimeTrackingApiError(401, null));
    const store = useTaskTimerStore();

    await store.initialize();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    expect(store.initialized).toBe(false);
    expect(store.currentTimer).toBeNull();
  });
});
