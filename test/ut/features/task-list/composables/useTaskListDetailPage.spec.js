import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskListApiError } from "@/features/task-list/api/taskListApi";
import {
  TASK_LIST_SUBMIT_CONTROL,
  useTaskListDetailPage,
} from "@/features/task-list/composables/useTaskListDetailPage";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
  taskListStore: {
    findTaskDetail: vi.fn(),
    isLoading: false,
    upsertTaskInfo: vi.fn(),
  },
  userStore: {
    clearSession: vi.fn(),
    hasPermission: vi.fn(),
    accountId: 5,
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/features/task-list/stores/taskList", () => ({
  useTaskListStore: () => mocks.taskListStore,
}));

vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

describe("useTaskListDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.taskListStore.isLoading = false;
    mocks.userStore.accountId = 5;
    mocks.userStore.hasPermission.mockImplementation(
      (permissionCode) => permissionCode === "TASK_WRITE_ALL"
    );
  });

  it("Task IDに対応する詳細をフォームへ設定する", async () => {
    mocks.taskListStore.findTaskDetail.mockResolvedValue({
      task_id: 42,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "詳細画面",
      detail: "composableへ移す",
      done_flag: "1",
      user_id: 5,
      priority: 2,
      version: 4,
    });

    const page = useTaskListDetailPage(ref(42));

    await vi.waitFor(() => {
      expect(page.taskListForm.taskId).toBe(42);
    });
    expect(page.taskListForm.doneFlag).toBe(1);
    // 担当者名が返らない（会員に姓・名がない）場合はユーザーIDで示す。
    expect(page.fullName.value).toBe("ユーザーID: 5");
    expect(mocks.taskListStore.findTaskDetail).toHaveBeenCalledWith(42);
  });

  it("担当者名が返れば、対象ユーザーを内部のIDではなく名前で示す", async () => {
    mocks.taskListStore.findTaskDetail.mockResolvedValue({
      task_id: 42,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "詳細画面",
      detail: "担当者名",
      done_flag: "0",
      user_id: 5,
      owner_name: "松浦 大地",
      priority: 2,
      version: 4,
    });

    const page = useTaskListDetailPage(ref(42));

    await vi.waitFor(() => {
      expect(page.fullName.value).toBe("松浦 大地");
    });
  });

  it("新規登録では詳細APIを呼ばず初期フォームを使用する", async () => {
    const page = useTaskListDetailPage(ref(0));

    await Promise.resolve();

    expect(mocks.taskListStore.findTaskDetail).not.toHaveBeenCalled();
    expect(page.taskListForm).toMatchObject({ taskId: 0, doneFlag: 0, priority: 3 });
  });

  it("詳細取得失敗時は画面用メッセージを設定する", async () => {
    mocks.taskListStore.findTaskDetail.mockRejectedValue(new TaskListApiError(404, null));

    const page = useTaskListDetailPage(ref(999));

    await vi.waitFor(() => {
      expect(page.loadError.value).toBe("対象のTaskが見つかりません。");
    });
  });

  it("詳細取得の401ではフォームとSession表示を破棄してLoginへ戻す", async () => {
    mocks.taskListStore.findTaskDetail.mockRejectedValue(new TaskListApiError(401, null));

    const page = useTaskListDetailPage(ref(42));

    await vi.waitFor(() => {
      expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    });
    expect(page.taskListForm.taskId).toBe(0);
    expect(page.loadError.value).toBe("");
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
  });

  it("編集画面のクリアでは取得時の内容へ戻す", async () => {
    mocks.taskListStore.findTaskDetail.mockResolvedValue({
      task_id: 42,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "取得時タイトル",
      detail: "詳細",
      done_flag: "0",
      user_id: 5,
      priority: 2,
      version: 4,
    });
    const page = useTaskListDetailPage(ref(42));
    await vi.waitFor(() => expect(page.taskListForm.taskId).toBe(42));
    page.taskListForm.title = "編集中タイトル";

    await page.clearForm();

    expect(page.taskListForm.title).toBe("取得時タイトル");
    expect(mocks.taskListStore.findTaskDetail).toHaveBeenCalledTimes(2);
  });

  it("確認したフォームを登録更新RequestとしてStoreへ渡す", async () => {
    mocks.taskListStore.upsertTaskInfo.mockResolvedValue(undefined);
    const page = useTaskListDetailPage(ref(0));
    Object.assign(page.taskListForm, {
      dateFrom: "2026-08-08",
      dateTo: "2026-08-31",
      title: "新規Task",
      detail: "登録する",
      doneFlag: 0,
      userId: 5,
      priority: 2,
    });
    page.showConfirm();

    await page.confirmSubmit();

    expect(page.isShowConfirm.value).toBe(false);
    expect(mocks.taskListStore.upsertTaskInfo).toHaveBeenCalledWith({
      task_id: 0,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "新規Task",
      detail: "登録する",
      done_flag: "0",
      priority: 2,
      version: 0,
      user_id: 5,
    });
    expect(page.successMessage.value).toBe("Taskを登録しました。");
    expect(page.taskListForm.taskId).toBe(0);
  });

  it("更新permissionがない場合は確認画面と保存APIを開かない", async () => {
    mocks.userStore.hasPermission.mockReturnValue(false);
    const page = useTaskListDetailPage(ref(0));

    page.showConfirm();
    await page.confirmSubmit();

    expect(page.isShowConfirm.value).toBe(false);
    expect(mocks.taskListStore.upsertTaskInfo).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual(["Taskを更新するpermissionがありません。"]);
  });

  it("本人更新permissionでは他人が所有するTaskを参照専用にする", async () => {
    mocks.userStore.hasPermission.mockImplementation(
      (permissionCode) => permissionCode === "TASK_WRITE_OWN"
    );
    mocks.taskListStore.findTaskDetail.mockResolvedValue({
      task_id: 42,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "他人のTask",
      detail: "参照だけ許可された組み合わせ",
      done_flag: "0",
      user_id: 8,
      priority: 2,
      version: 0,
    });

    const page = useTaskListDetailPage(ref(42));
    await vi.waitFor(() => expect(page.taskListForm.taskId).toBe(42));

    expect(page.canWriteTask.value).toBe(false);
  });

  it("入力エラーResponseを画面メッセージへ変換する", async () => {
    mocks.taskListStore.upsertTaskInfo.mockRejectedValue(
      new TaskListApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "title",
            message: "タイトルは必須です",
          },
        ],
      })
    );
    const page = useTaskListDetailPage(ref(0));

    await page.confirmSubmit();

    expect(page.errorMessages.value).toEqual(["タイトルは必須です"]);
  });

  it("codeなしの旧日付エラー本文を表示せず固定文言へ閉じる", async () => {
    mocks.taskListStore.upsertTaskInfo.mockRejectedValue(
      new TaskListApiError(400, {
        fieldErrors: [
          {
            errorCode: null,
            field: "dateTo",
            message: "古いControllerの文言",
          },
        ],
      })
    );
    const page = useTaskListDetailPage(ref(0));

    await page.confirmSubmit();

    expect(page.errorMessages.value).toEqual(["Task情報を保存できませんでした。"]);
  });

  it("更新確定後に詳細を再取得して新しいversionへ置き換える", async () => {
    mocks.taskListStore.findTaskDetail
      .mockResolvedValueOnce({
        task_id: 42,
        date_from: "2026-08-08",
        date_to: "2026-08-31",
        title: "更新前",
        detail: "詳細",
        done_flag: "0",
        user_id: 5,
        priority: 2,
        version: 4,
      })
      .mockResolvedValueOnce({
        task_id: 42,
        date_from: "2026-08-08",
        date_to: "2026-08-31",
        title: "更新後",
        detail: "詳細",
        done_flag: "0",
        user_id: 5,
        priority: 2,
        version: 5,
      });
    mocks.taskListStore.upsertTaskInfo.mockResolvedValue(undefined);
    const page = useTaskListDetailPage(ref(42));
    await vi.waitFor(() => expect(page.taskListForm.version).toBe(4));

    await page.confirmSubmit();

    expect(page.taskListForm.title).toBe("更新後");
    expect(page.taskListForm.version).toBe(5);
    expect(page.successMessage.value).toBe("Taskを更新しました。");
  });

  it("更新確定後の再取得失敗を保存失敗と区別する", async () => {
    mocks.taskListStore.findTaskDetail
      .mockResolvedValueOnce({
        task_id: 42,
        date_from: "2026-08-08",
        date_to: "2026-08-31",
        title: "更新前",
        detail: "詳細",
        done_flag: "0",
        user_id: 5,
        priority: 2,
        version: 4,
      })
      .mockRejectedValueOnce(new Error("offline"));
    mocks.taskListStore.upsertTaskInfo.mockResolvedValue(undefined);
    const page = useTaskListDetailPage(ref(42));
    await vi.waitFor(() => expect(page.taskListForm.version).toBe(4));

    await page.confirmSubmit();

    expect(page.successMessage.value).toBe("");
    expect(page.taskListForm.taskId).toBe(0);
    expect(page.errorMessages.value).toEqual([
      "Taskは保存されましたが、最新情報を取得できませんでした。Task一覧から開き直してください。",
    ]);
  });

  it("409では古いdraftを破棄して最新versionを再取得する", async () => {
    mocks.taskListStore.findTaskDetail
      .mockResolvedValueOnce({
        task_id: 42,
        date_from: "2026-08-08",
        date_to: "2026-08-31",
        title: "古いdraftの元",
        detail: "詳細",
        done_flag: "0",
        user_id: 5,
        priority: 2,
        version: 4,
      })
      .mockResolvedValueOnce({
        task_id: 42,
        date_from: "2026-08-08",
        date_to: "2026-08-31",
        title: "別tabの更新",
        detail: "最新詳細",
        done_flag: "0",
        user_id: 5,
        priority: 3,
        version: 5,
      });
    mocks.taskListStore.upsertTaskInfo.mockRejectedValue(new TaskListApiError(409, null));
    const page = useTaskListDetailPage(ref(42));
    await vi.waitFor(() => expect(page.taskListForm.version).toBe(4));
    page.taskListForm.title = "破棄対象draft";

    await page.confirmSubmit();

    expect(page.taskListForm.title).toBe("別tabの更新");
    expect(page.taskListForm.version).toBe(5);
    expect(page.errorMessages.value).toEqual([
      "Taskが別の操作で更新されたか、対象が存在しません。最新情報を確認してください。",
    ]);
  });

  it("409回復中の401は古い競合案内よりSession失効を優先する", async () => {
    mocks.taskListStore.findTaskDetail
      .mockResolvedValueOnce({
        task_id: 42,
        date_from: "2026-08-08",
        date_to: "2026-08-31",
        title: "更新前",
        detail: "詳細",
        done_flag: "0",
        user_id: 5,
        priority: 2,
        version: 4,
      })
      .mockRejectedValueOnce(new TaskListApiError(401, null));
    mocks.taskListStore.upsertTaskInfo.mockRejectedValue(new TaskListApiError(409, null));
    const page = useTaskListDetailPage(ref(42));
    await vi.waitFor(() => expect(page.taskListForm.version).toBe(4));

    await page.confirmSubmit();

    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  describe("確認Dialogを閉じた後のフォーカス", () => {
    // 単体テストの実行環境にはDOMがないため、部品を探すdocumentを差し替える。
    const stubDocument = () => {
      const focused = [];
      vi.stubGlobal("document", {
        querySelector: (selector) => ({
          focus: () => focused.push(selector.match(/data-task-list-detail-control="([^"]+)"/)?.[1]),
          matches: () => false,
        }),
      });
      return focused;
    };

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("「戻る」で閉じたときも、登録した後も「登録する」へ戻す", async () => {
      mocks.userStore.hasPermission.mockReturnValue(true);
      mocks.taskListStore.upsertTaskInfo.mockResolvedValue(undefined);
      const page = useTaskListDetailPage(ref(0));
      await vi.waitFor(() => expect(page.taskListForm.taskId).toBe(0));
      const focused = stubDocument();

      page.showConfirm();
      page.closeConfirm();
      await vi.waitFor(() => expect(focused).toHaveLength(1));
      page.showConfirm();
      await page.confirmSubmit();

      expect(focused.every((key) => key === TASK_LIST_SUBMIT_CONTROL)).toBe(true);
      expect(focused.length).toBeGreaterThanOrEqual(2);
    });
  });
});
