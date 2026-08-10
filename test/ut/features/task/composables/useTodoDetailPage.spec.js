import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTodoDetailPage } from "@/features/task/composables/useTodoDetailPage";

const mocks = vi.hoisted(() => ({
  todoStore: {
    findTodoDetail: vi.fn(),
    isLoading: false,
    upsertTodoInfo: vi.fn(),
  },
  userStore: {
    getRole: 1,
  },
}));

vi.mock("@/features/task/stores/task", () => ({
  useTodoStore: () => mocks.todoStore,
}));

vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

describe("useTodoDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.todoStore.isLoading = false;
    mocks.userStore.getRole = 1;
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
    expect(page.fullName.value).toBe("ユーザーID: 5");
    expect(mocks.todoStore.findTodoDetail).toHaveBeenCalledWith(42);
  });

  it("新規登録では詳細APIを呼ばず初期フォームを使用する", async () => {
    const page = useTodoDetailPage(ref(0));

    await Promise.resolve();

    expect(mocks.todoStore.findTodoDetail).not.toHaveBeenCalled();
    expect(page.todoForm).toMatchObject({ todoId: 0, doneFlag: 0, priority: 3 });
  });

  it("詳細取得失敗時は画面用メッセージを設定する", async () => {
    mocks.todoStore.findTodoDetail.mockRejectedValue(new Error("not found"));

    const page = useTodoDetailPage(ref(999));

    await vi.waitFor(() => {
      expect(page.loadError.value).toContain("Todo情報を取得できませんでした");
    });
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
    mocks.todoStore.upsertTodoInfo.mockResolvedValue({ ok: true });
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
      role: 1,
      priority: 2,
      version: 0,
      user_id: 5,
    });
    expect(page.successMessage.value).toBe("Todoを登録しました。");
    expect(page.todoForm.todoId).toBe(0);
  });

  it("入力エラーResponseを画面メッセージへ変換する", async () => {
    mocks.todoStore.upsertTodoInfo.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        fieldErrors: [{ field: "title", message: "タイトルは必須です" }],
      }),
    });
    const page = useTodoDetailPage(ref(0));

    await page.confirmSubmit();

    expect(page.errorMessages.value).toEqual(["タイトルは必須です"]);
  });
});
