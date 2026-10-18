import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskApiError } from "@/features/task/api/taskApi";
import { useTodoListPage } from "@/features/task/composables/useTodoListPage";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
  todoStore: {
    completeTodo: vi.fn(),
    findTodoList: vi.fn(),
    setTodoList: vi.fn(),
  },
  userStore: {
    clearSession: vi.fn(),
    hasPermission: vi.fn(),
    memberId: 5,
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/features/task/stores/task", () => ({
  useTodoStore: () => mocks.todoStore,
}));

vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

const todo = {
  todoId: 42,
  title: "設計",
  detail: "詳細",
  doneFlag: false,
};

describe("useTodoListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.todoStore.findTodoList.mockResolvedValue({ todoList: [] });
    mocks.userStore.memberId = 5;
    mocks.userStore.hasPermission.mockImplementation(
      (permissionCode) => permissionCode === "TASK_WRITE_ALL"
    );
  });

  it("初期条件でTodo一覧を取得してStoreにも保存する", async () => {
    mocks.todoStore.findTodoList.mockResolvedValue({
      todoList: [todo],
    });
    const page = useTodoListPage();

    await page.initialize();

    expect(mocks.todoStore.findTodoList).toHaveBeenCalledWith({
      search_title: "",
      date_range: "",
      done_flag_values: [0, 1],
    });
    expect(page.todoList.value).toEqual([todo]);
    expect(mocks.todoStore.setTodoList).toHaveBeenCalledWith([todo]);
  });

  it("入力されたタイトルと完了状態で検索する", async () => {
    mocks.todoStore.findTodoList.mockResolvedValue({
      todoList: [],
    });
    const page = useTodoListPage();
    page.searchTitle.value = "設計";
    page.selectedDoneFlag.value = ["0"];

    await page.search();

    expect(mocks.todoStore.findTodoList).toHaveBeenCalledWith({
      search_title: "設計",
      date_range: "",
      done_flag_values: [0],
    });
  });

  it("入力エラーResponseを画面メッセージへ変換する", async () => {
    mocks.todoStore.findTodoList.mockRejectedValue(
      new TaskApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "searchTitle",
            message: "タイトルが不正です",
          },
        ],
      })
    );
    const page = useTodoListPage();

    await page.search();

    expect(page.errorMessages.value).toEqual(["タイトルが不正です"]);
  });

  it("Todoを完了状態へ更新する", async () => {
    mocks.todoStore.completeTodo.mockResolvedValue(undefined);
    mocks.todoStore.findTodoList.mockResolvedValue({
      todoList: [{ ...todo, doneFlag: true }],
    });
    const page = useTodoListPage();
    const item = { ...todo };

    await page.completeTodo(item);

    expect(mocks.todoStore.completeTodo).toHaveBeenCalledWith(42);
    expect(mocks.todoStore.findTodoList).toHaveBeenCalledWith({
      search_title: "",
      date_range: "",
      done_flag_values: [0, 1],
    });
    expect(item.doneFlag).toBe(true);
  });

  it("既知codeの複数入力エラーをBackend順で表示する", async () => {
    mocks.todoStore.findTodoList.mockRejectedValue(
      new TaskApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "searchTitle",
            message: "1件目",
          },
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "doneFlagValues",
            message: "2件目",
          },
        ],
      })
    );
    const page = useTodoListPage();

    await page.search();

    expect(page.errorMessages.value).toEqual(["1件目", "2件目"]);
  });

  it("未知codeを含むBackend本文は部分表示せず固定文言へ閉じる", async () => {
    mocks.todoStore.findTodoList.mockRejectedValue(
      new TaskApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "searchTitle",
            message: "表示してはいけない既知文言",
          },
          {
            errorCode: "UNKNOWN_VALIDATION",
            field: "secret",
            message: "SQL details",
          },
        ],
      })
    );
    const page = useTodoListPage();

    await page.search();

    expect(page.errorMessages.value).toEqual([
      "Todo情報を取得できませんでした。",
    ]);
  });

  it("本文なし403ではSessionを維持して古い一覧を破棄する", async () => {
    const page = useTodoListPage();
    mocks.todoStore.findTodoList.mockResolvedValueOnce({ todoList: [todo] });
    await page.initialize();
    mocks.todoStore.findTodoList.mockRejectedValue(new TaskApiError(403, null));

    await page.search();

    expect(page.todoList.value).toEqual([]);
    expect(page.errorMessages.value).toEqual([
      "Todoを参照するpermissionがありません。",
    ]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("401では一覧とSession表示を破棄してLoginへ戻す", async () => {
    mocks.todoStore.findTodoList.mockRejectedValue(new TaskApiError(401, null));
    const page = useTodoListPage();

    await page.search();

    expect(page.todoList.value).toEqual([]);
    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("完了確定後の再取得失敗を完了操作失敗と区別する", async () => {
    mocks.todoStore.completeTodo.mockResolvedValue(undefined);
    mocks.todoStore.findTodoList.mockRejectedValue(new Error("offline"));
    const page = useTodoListPage();
    const item = { ...todo };

    await page.completeTodo(item);

    expect(item.doneFlag).toBe(true);
    expect(page.errorMessages.value).toEqual([
      "Todoは完了しましたが、最新の一覧を取得できませんでした。再読込してください。",
    ]);
  });

  it("完了404の回復中に401となった場合はSession失効を優先する", async () => {
    mocks.todoStore.completeTodo.mockRejectedValue(new TaskApiError(404, null));
    mocks.todoStore.findTodoList.mockRejectedValue(new TaskApiError(401, null));
    const page = useTodoListPage();
    const item = { ...todo };

    await page.completeTodo(item);

    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("更新permissionがない場合は完了APIを呼ばない", async () => {
    mocks.userStore.hasPermission.mockReturnValue(false);
    const page = useTodoListPage();
    const item = { ...todo };

    await page.completeTodo(item);

    expect(mocks.todoStore.completeTodo).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual([
      "Todoを更新するpermissionがありません。",
    ]);
  });

  it("本人更新permissionでは他人のTodoを完了できない", async () => {
    mocks.userStore.hasPermission.mockImplementation(
      (permissionCode) => permissionCode === "TASK_WRITE_OWN"
    );
    const page = useTodoListPage();
    const item = { ...todo, userId: 8 };

    await page.completeTodo(item);

    expect(page.canWriteTodo(item)).toBe(false);
    expect(mocks.todoStore.completeTodo).not.toHaveBeenCalled();
  });

  it("Todo詳細画面へTodo ID付きで移動する", () => {
    const page = useTodoListPage();

    page.showTodoDetail(todo);

    expect(mocks.router.push).toHaveBeenCalledWith({
      name: "TodoDetail",
      params: { id: 42 },
    });
  });
});
