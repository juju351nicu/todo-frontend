import { beforeEach, describe, expect, it, vi } from "vitest";

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
    mocks.userStore.memberId = 5;
    mocks.userStore.hasPermission.mockImplementation(
      (permissionCode) => permissionCode === "TASK_WRITE_ALL"
    );
  });

  it("初期条件でTodo一覧を取得してStoreにも保存する", async () => {
    mocks.todoStore.findTodoList.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ todoList: [todo] }),
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
      ok: true,
      json: vi.fn().mockResolvedValue({ todoList: [] }),
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
    mocks.todoStore.findTodoList.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        fieldErrors: [{ field: "search_title", message: "タイトルが不正です" }],
      }),
    });
    const page = useTodoListPage();

    await page.search();

    expect(page.errorMessages.value).toEqual(["タイトルが不正です"]);
  });

  it("Todoを完了状態へ更新する", async () => {
    mocks.todoStore.completeTodo.mockResolvedValue({ ok: true });
    const page = useTodoListPage();
    const item = { ...todo };

    await page.completeTodo(item);

    expect(mocks.todoStore.completeTodo).toHaveBeenCalledWith(42);
    expect(item.doneFlag).toBe(true);
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
