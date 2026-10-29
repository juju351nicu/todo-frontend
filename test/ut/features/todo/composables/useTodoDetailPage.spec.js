import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TodoApiError } from "@/features/todo/api/todoApi";
import {
  TODO_SUBMIT_CONTROL,
  useTodoDetailPage,
} from "@/features/todo/composables/useTodoDetailPage";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
  todoStore: {
    findTodoDetail: vi.fn(),
    isLoading: false,
    upsertTodoInfo: vi.fn(),
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

vi.mock("@/features/todo/stores/todo", () => ({
  useTodoStore: () => mocks.todoStore,
}));

vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

describe("useTodoDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.todoStore.isLoading = false;
    mocks.userStore.accountId = 5;
    mocks.userStore.hasPermission.mockImplementation(
      (permissionCode) => permissionCode === "TASK_WRITE_ALL"
    );
  });

  it("Todo IDに対応する詳細をフォームへ設定する", async () => {
    mocks.todoStore.findTodoDetail.mockResolvedValue({
      todo_id: 42,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "詳細画面",
      detail: "composableへ移す",
      done_flag: "1",
      user_id: 5,
      priority: 2,
      version: 4,
    });

    const page = useTodoDetailPage(ref(42));

    await vi.waitFor(() => {
      expect(page.todoForm.todoId).toBe(42);
    });
    expect(page.todoForm.doneFlag).toBe(1);
    // 担当者名が返らない（会員に姓・名がない）場合はユーザーIDで示す。
    expect(page.fullName.value).toBe("ユーザーID: 5");
    expect(mocks.todoStore.findTodoDetail).toHaveBeenCalledWith(42);
  });

  it("担当者名が返れば、対象ユーザーを内部のIDではなく名前で示す", async () => {
    mocks.todoStore.findTodoDetail.mockResolvedValue({
      todo_id: 42,
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

    const page = useTodoDetailPage(ref(42));

    await vi.waitFor(() => {
      expect(page.fullName.value).toBe("松浦 大地");
    });
  });

  it("新規登録では詳細APIを呼ばず初期フォームを使用する", async () => {
    const page = useTodoDetailPage(ref(0));

    await Promise.resolve();

    expect(mocks.todoStore.findTodoDetail).not.toHaveBeenCalled();
    expect(page.todoForm).toMatchObject({ todoId: 0, doneFlag: 0, priority: 3 });
  });

  it("詳細取得失敗時は画面用メッセージを設定する", async () => {
    mocks.todoStore.findTodoDetail.mockRejectedValue(new TodoApiError(404, null));

    const page = useTodoDetailPage(ref(999));

    await vi.waitFor(() => {
      expect(page.loadError.value).toBe("対象のTodoが見つかりません。");
    });
  });

  it("詳細取得の401ではフォームとSession表示を破棄してLoginへ戻す", async () => {
    mocks.todoStore.findTodoDetail.mockRejectedValue(new TodoApiError(401, null));

    const page = useTodoDetailPage(ref(42));

    await vi.waitFor(() => {
      expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    });
    expect(page.todoForm.todoId).toBe(0);
    expect(page.loadError.value).toBe("");
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
  });

  it("編集画面のクリアでは取得時の内容へ戻す", async () => {
    mocks.todoStore.findTodoDetail.mockResolvedValue({
      todo_id: 42,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "取得時タイトル",
      detail: "詳細",
      done_flag: "0",
      user_id: 5,
      priority: 2,
      version: 4,
    });
    const page = useTodoDetailPage(ref(42));
    await vi.waitFor(() => expect(page.todoForm.todoId).toBe(42));
    page.todoForm.title = "編集中タイトル";

    await page.clearForm();

    expect(page.todoForm.title).toBe("取得時タイトル");
    expect(mocks.todoStore.findTodoDetail).toHaveBeenCalledTimes(2);
  });

  it("確認したフォームを登録更新RequestとしてStoreへ渡す", async () => {
    mocks.todoStore.upsertTodoInfo.mockResolvedValue(undefined);
    const page = useTodoDetailPage(ref(0));
    Object.assign(page.todoForm, {
      dateFrom: "2026-08-08",
      dateTo: "2026-08-31",
      title: "新規Todo",
      detail: "登録する",
      doneFlag: 0,
      userId: 5,
      priority: 2,
    });
    page.showConfirm();

    await page.confirmSubmit();

    expect(page.isShowConfirm.value).toBe(false);
    expect(mocks.todoStore.upsertTodoInfo).toHaveBeenCalledWith({
      todo_id: 0,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "新規Todo",
      detail: "登録する",
      done_flag: "0",
      priority: 2,
      version: 0,
      user_id: 5,
    });
    expect(page.successMessage.value).toBe("Todoを登録しました。");
    expect(page.todoForm.todoId).toBe(0);
  });

  it("更新permissionがない場合は確認画面と保存APIを開かない", async () => {
    mocks.userStore.hasPermission.mockReturnValue(false);
    const page = useTodoDetailPage(ref(0));

    page.showConfirm();
    await page.confirmSubmit();

    expect(page.isShowConfirm.value).toBe(false);
    expect(mocks.todoStore.upsertTodoInfo).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual(["Todoを更新するpermissionがありません。"]);
  });

  it("本人更新permissionでは他人が所有するTodoを参照専用にする", async () => {
    mocks.userStore.hasPermission.mockImplementation(
      (permissionCode) => permissionCode === "TASK_WRITE_OWN"
    );
    mocks.todoStore.findTodoDetail.mockResolvedValue({
      todo_id: 42,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "他人のTodo",
      detail: "参照だけ許可された組み合わせ",
      done_flag: "0",
      user_id: 8,
      priority: 2,
      version: 0,
    });

    const page = useTodoDetailPage(ref(42));
    await vi.waitFor(() => expect(page.todoForm.todoId).toBe(42));

    expect(page.canWriteTodo.value).toBe(false);
  });

  it("入力エラーResponseを画面メッセージへ変換する", async () => {
    mocks.todoStore.upsertTodoInfo.mockRejectedValue(
      new TodoApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "title",
            message: "タイトルは必須です",
          },
        ],
      })
    );
    const page = useTodoDetailPage(ref(0));

    await page.confirmSubmit();

    expect(page.errorMessages.value).toEqual(["タイトルは必須です"]);
  });

  it("codeなしの旧日付エラー本文を表示せず固定文言へ閉じる", async () => {
    mocks.todoStore.upsertTodoInfo.mockRejectedValue(
      new TodoApiError(400, {
        fieldErrors: [
          {
            errorCode: null,
            field: "dateTo",
            message: "古いControllerの文言",
          },
        ],
      })
    );
    const page = useTodoDetailPage(ref(0));

    await page.confirmSubmit();

    expect(page.errorMessages.value).toEqual(["Todo情報を保存できませんでした。"]);
  });

  it("更新確定後に詳細を再取得して新しいversionへ置き換える", async () => {
    mocks.todoStore.findTodoDetail
      .mockResolvedValueOnce({
        todo_id: 42,
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
        todo_id: 42,
        date_from: "2026-08-08",
        date_to: "2026-08-31",
        title: "更新後",
        detail: "詳細",
        done_flag: "0",
        user_id: 5,
        priority: 2,
        version: 5,
      });
    mocks.todoStore.upsertTodoInfo.mockResolvedValue(undefined);
    const page = useTodoDetailPage(ref(42));
    await vi.waitFor(() => expect(page.todoForm.version).toBe(4));

    await page.confirmSubmit();

    expect(page.todoForm.title).toBe("更新後");
    expect(page.todoForm.version).toBe(5);
    expect(page.successMessage.value).toBe("Todoを更新しました。");
  });

  it("更新確定後の再取得失敗を保存失敗と区別する", async () => {
    mocks.todoStore.findTodoDetail
      .mockResolvedValueOnce({
        todo_id: 42,
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
    mocks.todoStore.upsertTodoInfo.mockResolvedValue(undefined);
    const page = useTodoDetailPage(ref(42));
    await vi.waitFor(() => expect(page.todoForm.version).toBe(4));

    await page.confirmSubmit();

    expect(page.successMessage.value).toBe("");
    expect(page.todoForm.todoId).toBe(0);
    expect(page.errorMessages.value).toEqual([
      "Todoは保存されましたが、最新情報を取得できませんでした。Todo一覧から開き直してください。",
    ]);
  });

  it("409では古いdraftを破棄して最新versionを再取得する", async () => {
    mocks.todoStore.findTodoDetail
      .mockResolvedValueOnce({
        todo_id: 42,
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
        todo_id: 42,
        date_from: "2026-08-08",
        date_to: "2026-08-31",
        title: "別tabの更新",
        detail: "最新詳細",
        done_flag: "0",
        user_id: 5,
        priority: 3,
        version: 5,
      });
    mocks.todoStore.upsertTodoInfo.mockRejectedValue(new TodoApiError(409, null));
    const page = useTodoDetailPage(ref(42));
    await vi.waitFor(() => expect(page.todoForm.version).toBe(4));
    page.todoForm.title = "破棄対象draft";

    await page.confirmSubmit();

    expect(page.todoForm.title).toBe("別tabの更新");
    expect(page.todoForm.version).toBe(5);
    expect(page.errorMessages.value).toEqual([
      "Todoが別の操作で更新されたか、対象が存在しません。最新情報を確認してください。",
    ]);
  });

  it("409回復中の401は古い競合案内よりSession失効を優先する", async () => {
    mocks.todoStore.findTodoDetail
      .mockResolvedValueOnce({
        todo_id: 42,
        date_from: "2026-08-08",
        date_to: "2026-08-31",
        title: "更新前",
        detail: "詳細",
        done_flag: "0",
        user_id: 5,
        priority: 2,
        version: 4,
      })
      .mockRejectedValueOnce(new TodoApiError(401, null));
    mocks.todoStore.upsertTodoInfo.mockRejectedValue(new TodoApiError(409, null));
    const page = useTodoDetailPage(ref(42));
    await vi.waitFor(() => expect(page.todoForm.version).toBe(4));

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
          focus: () => focused.push(selector.match(/data-todo-detail-control="([^"]+)"/)?.[1]),
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
      mocks.todoStore.upsertTodoInfo.mockResolvedValue(undefined);
      const page = useTodoDetailPage(ref(0));
      await vi.waitFor(() => expect(page.todoForm.todoId).toBe(0));
      const focused = stubDocument();

      page.showConfirm();
      page.closeConfirm();
      await vi.waitFor(() => expect(focused).toHaveLength(1));
      page.showConfirm();
      await page.confirmSubmit();

      expect(focused.every((key) => key === TODO_SUBMIT_CONTROL)).toBe(true);
      expect(focused.length).toBeGreaterThanOrEqual(2);
    });
  });
});
