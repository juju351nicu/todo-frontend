import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskCommentApiError } from "@/features/task/api/taskCommentApi";
import { useProjectComments } from "@/features/task/composables/useProjectComments";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  taskCommentApi: { findProjectComments: vi.fn() },
  userStore: { clearSession: vi.fn() },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/task/api/taskCommentApi", async () => {
  const actual = await vi.importActual(
    "@/features/task/api/taskCommentApi"
  );
  return { ...actual, default: mocks.taskCommentApi };
});

const comment = {
  commentId: 41,
  taskId: 31,
  taskTitle: "対象Task",
  taskArchived: false,
  authorAccountId: 7,
  authorDisplayName: "投稿者",
  body: "Project一覧コメント",
  createdAt: "2026-09-20T01:00:00Z",
  updatedAt: "2026-09-20T02:00:00Z",
  version: 1,
};

describe("useProjectComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.taskCommentApi.findProjectComments.mockResolvedValue([comment]);
  });

  it("Dialogを開くたびにProject内の最新コメントを取得する", async () => {
    const page = useProjectComments(ref(5));

    await page.openComments();
    page.closeComments();
    await page.openComments();

    expect(mocks.taskCommentApi.findProjectComments).toHaveBeenCalledTimes(2);
    expect(mocks.taskCommentApi.findProjectComments).toHaveBeenNthCalledWith(
      1,
      5
    );
    expect(page.comments.value).toEqual([comment]);
    expect(page.isOpen.value).toBe(true);
  });

  it("取得中の再読込ではAPIを二重実行しない", async () => {
    let resolveRequest;
    mocks.taskCommentApi.findProjectComments.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );
    const page = useProjectComments(ref(5));

    const first = page.openComments();
    const second = page.loadComments();

    expect(mocks.taskCommentApi.findProjectComments).toHaveBeenCalledOnce();
    resolveRequest([comment]);
    await Promise.all([first, second]);
  });

  it("403ではBackendの項目メッセージを表示して古い一覧を破棄する", async () => {
    mocks.taskCommentApi.findProjectComments.mockRejectedValue(
      new TaskCommentApiError(403, {
        fieldErrors: [
          { field: "permission", message: "参照権限がありません。" },
        ],
      })
    );
    const page = useProjectComments(ref(5));

    await page.openComments();

    expect(page.comments.value).toEqual([]);
    expect(page.errorMessage.value).toBe("参照権限がありません。");
    expect(page.isOpen.value).toBe(true);
  });

  it("401ではSessionを破棄してDialogを閉じLoginへ戻す", async () => {
    mocks.taskCommentApi.findProjectComments.mockRejectedValue(
      new TaskCommentApiError(401, null)
    );
    const page = useProjectComments(ref(5));

    await page.openComments();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    expect(page.isOpen.value).toBe(false);
  });

  it("Project IDがない場合はDialogを開かずAPIを呼ばない", async () => {
    const page = useProjectComments(ref(null));

    await page.openComments();

    expect(mocks.taskCommentApi.findProjectComments).not.toHaveBeenCalled();
    expect(page.isOpen.value).toBe(false);
  });
});
