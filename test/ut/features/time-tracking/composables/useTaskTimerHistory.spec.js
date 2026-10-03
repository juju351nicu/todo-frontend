import { beforeEach, describe, expect, it, vi } from "vitest";

import { TimeTrackingApiError } from "@/features/time-tracking/api/timeTrackingApi";
import { useTaskTimerHistory } from "@/features/time-tracking/composables/useTaskTimerHistory";

const mocks = vi.hoisted(() => ({
  api: { getSessions: vi.fn() },
  router: { push: vi.fn() },
  userStore: { clearSession: vi.fn() },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/time-tracking/api/timeTrackingApi", async () => {
  const actual = await vi.importActual(
    "@/features/time-tracking/api/timeTrackingApi"
  );
  return { ...actual, default: mocks.api };
});

const historyResponse = {
  dateFrom: "2026-09-01",
  dateTo: "2026-09-30",
  sessions: [{ timerSessionId: 1, taskTitle: "実装" }],
  page: 0,
  size: 20,
  totalElements: 21,
  totalPages: 2,
};

describe("useTaskTimerHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.api.getSessions.mockResolvedValue(historyResponse);
  });

  it("Dialogを開くと指定期間の先頭ページを取得する", async () => {
    const history = useTaskTimerHistory();
    history.dateFrom.value = "2026-09-01";
    history.dateTo.value = "2026-09-30";

    await history.openDialog();

    expect(mocks.api.getSessions).toHaveBeenCalledWith({
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      page: 0,
      size: 20,
    });
    expect(history.history.value).toEqual(historyResponse);
  });

  it("実在しない日付と366日超過ではAPIを呼ばない", async () => {
    const history = useTaskTimerHistory();
    history.dateFrom.value = "2026-02-31";
    history.dateTo.value = "2026-03-10";
    await history.loadHistory();

    expect(mocks.api.getSessions).not.toHaveBeenCalled();
    expect(history.errorMessages.value).toEqual([
      "実在する開始日と終了日を入力してください。",
    ]);

    history.dateFrom.value = "2025-01-01";
    history.dateTo.value = "2026-01-02";
    await history.loadHistory();
    expect(mocks.api.getSessions).not.toHaveBeenCalled();
    expect(history.errorMessages.value).toEqual([
      "検索期間は366日以内にしてください。",
    ]);
  });

  it("最終ページより先ではAPIを呼ばず前ページは取得する", async () => {
    mocks.api.getSessions.mockResolvedValueOnce({
      ...historyResponse,
      page: 1,
    });
    const history = useTaskTimerHistory();
    history.dateFrom.value = "2026-09-01";
    history.dateTo.value = "2026-09-30";
    await history.loadHistory(1);
    mocks.api.getSessions.mockClear();

    await history.loadNextPage();
    expect(mocks.api.getSessions).not.toHaveBeenCalled();

    await history.loadPreviousPage();
    expect(mocks.api.getSessions).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0 })
    );
  });

  it("401ではDialogとSession表示を破棄してLoginへ戻す", async () => {
    mocks.api.getSessions.mockRejectedValue(
      new TimeTrackingApiError(401, null)
    );
    const history = useTaskTimerHistory();

    await history.openDialog();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    expect(history.isOpen.value).toBe(false);
  });
});
