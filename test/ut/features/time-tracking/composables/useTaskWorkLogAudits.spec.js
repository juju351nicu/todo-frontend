import { beforeEach, describe, expect, it, vi } from "vitest";

import { TimeTrackingApiError } from "@/features/time-tracking/api/timeTrackingApi";
import { useTaskWorkLogAudits } from "@/features/time-tracking/composables/useTaskWorkLogAudits";

const mocks = vi.hoisted(() => ({
  api: { getWorkLogAudits: vi.fn() },
  router: { push: vi.fn() },
  userStore: { clearSession: vi.fn() },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/time-tracking/api/timeTrackingApi", async () => {
  const actual = await vi.importActual("@/features/time-tracking/api/timeTrackingApi");
  return { ...actual, default: mocks.api };
});

const auditResponse = {
  projectId: 12,
  taskId: 345,
  audits: [{ workLogAuditId: 1, actionCode: "TIMER_APPLY" }],
  page: 0,
  size: 20,
  totalElements: 21,
  totalPages: 2,
};

describe("useTaskWorkLogAudits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.api.getWorkLogAudits.mockResolvedValue(auditResponse);
  });

  it("Dialogを開くと指定Taskの監査先頭ページを取得する", async () => {
    const audits = useTaskWorkLogAudits(12, 345);

    await audits.openDialog();

    expect(mocks.api.getWorkLogAudits).toHaveBeenCalledWith(12, 345, 0, 20);
    expect(audits.audits.value).toEqual(auditResponse);
  });

  it("paging端ではAPIを呼ばず存在する次ページだけを取得する", async () => {
    const audits = useTaskWorkLogAudits(12, 345);
    await audits.openDialog();
    mocks.api.getWorkLogAudits.mockClear();

    await audits.loadPreviousPage();
    expect(mocks.api.getWorkLogAudits).not.toHaveBeenCalled();

    await audits.loadNextPage();
    expect(mocks.api.getWorkLogAudits).toHaveBeenCalledWith(12, 345, 1, 20);
  });

  it("403を工数履歴の参照権限不足として案内する", async () => {
    mocks.api.getWorkLogAudits.mockRejectedValue(new TimeTrackingApiError(403, null));
    const audits = useTaskWorkLogAudits(12, 345);

    await audits.openDialog();

    expect(audits.errorMessages.value).toEqual([
      "Task実績工数の変更履歴を参照する権限がありません。",
    ]);
  });

  it("契約済み400の複数messageをBackend順で表示する", async () => {
    mocks.api.getWorkLogAudits.mockRejectedValue(
      new TimeTrackingApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_TASK_TIMER_REQUEST",
            field: "page",
            message: " pageを確認してください。 ",
          },
          {
            errorCode: "INVALID_TASK_TIMER_REQUEST",
            field: "size",
            message: "sizeを確認してください。",
          },
        ],
      })
    );
    const audits = useTaskWorkLogAudits(12, 345);

    await audits.openDialog();

    expect(audits.errorMessages.value).toEqual([
      "pageを確認してください。",
      "sizeを確認してください。",
    ]);
  });

  it("未知codeではBackend messageを表示せず監査用fallbackへ閉じる", async () => {
    mocks.api.getWorkLogAudits.mockRejectedValue(
      new TimeTrackingApiError(500, {
        fieldErrors: [
          {
            errorCode: "UNKNOWN_AUDIT_ERROR",
            field: "request",
            message: "内部情報を含み得る未契約文言",
          },
        ],
      })
    );
    const audits = useTaskWorkLogAudits(12, 345);

    await audits.openDialog();

    expect(audits.errorMessages.value).toEqual(["Task実績工数の変更履歴を取得できませんでした。"]);
  });

  it("404ではBackend本文に依存せず対象なしを表示する", async () => {
    mocks.api.getWorkLogAudits.mockRejectedValue(
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
    const audits = useTaskWorkLogAudits(12, 345);

    await audits.openDialog();

    expect(audits.errorMessages.value).toEqual(["対象のProjectまたはTaskが見つかりません。"]);
  });

  it("401ではDialogとSession表示を破棄してLoginへ戻す", async () => {
    mocks.api.getWorkLogAudits.mockRejectedValue(new TimeTrackingApiError(401, null));
    const audits = useTaskWorkLogAudits(12, 345);

    await audits.openDialog();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    expect(audits.isOpen.value).toBe(false);
  });
});
