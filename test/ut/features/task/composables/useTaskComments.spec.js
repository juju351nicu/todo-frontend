import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskCommentApiError } from "@/features/task/api/taskCommentApi";
import {
  COMMENT_COMPOSER_CONTROL,
  buildCommentEditControlKey,
  useTaskComments,
} from "@/features/task/composables/useTaskComments";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  taskCommentApi: {
    createComment: vi.fn(),
    deleteComment: vi.fn(),
    findComments: vi.fn(),
    updateComment: vi.fn(),
  },
  userStore: {
    accountId: 7,
    clearSession: vi.fn(),
  },
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

const ownComment = {
  commentId: 41,
  taskId: 31,
  authorAccountId: 7,
  authorDisplayName: "投稿者",
  authorAccountStatus: "ACTIVE",
  body: "変更前",
  createdAt: "2026-09-20T01:00:00Z",
  updatedAt: "2026-09-20T01:00:00Z",
  version: 0,
};

const otherComment = {
  ...ownComment,
  commentId: 42,
  authorAccountId: 8,
  authorDisplayName: "別の投稿者",
};

const createPage = (disabled = false) =>
  useTaskComments(ref(5), ref(31), ref(disabled));

const waitForInitialLoad = async () => {
  await vi.waitFor(() => {
    expect(mocks.taskCommentApi.findComments).toHaveBeenCalledWith(5, 31);
  });
};

describe("useTaskComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userStore.accountId = 7;
    mocks.router.push.mockResolvedValue(undefined);
    mocks.taskCommentApi.findComments.mockResolvedValue([
      structuredClone(ownComment),
      structuredClone(otherComment),
    ]);
    mocks.taskCommentApi.createComment.mockResolvedValue({
      ...ownComment,
      commentId: 43,
      body: "新しいコメント",
    });
    mocks.taskCommentApi.updateComment.mockResolvedValue({
      ...ownComment,
      body: "変更後",
      version: 1,
    });
    mocks.taskCommentApi.deleteComment.mockResolvedValue(undefined);
  });

  it("初期表示で対象Taskのコメント一覧を取得する", async () => {
    const page = createPage();

    await waitForInitialLoad();

    expect(page.comments.value).toEqual([ownComment, otherComment]);
  });

  it("Taskを切り替えた後に前のTaskのコメントが届いても、今のTaskのコメントを上書きしない", async () => {
    let resolvePreviousTaskList;
    mocks.taskCommentApi.findComments
      .mockReturnValueOnce(new Promise((resolve) => { resolvePreviousTaskList = resolve; }))
      .mockResolvedValueOnce([{ ...ownComment, taskId: 40, body: "今のTaskのコメント" }]);
    const taskId = ref(31);
    const page = useTaskComments(ref(5), taskId, ref(false));

    taskId.value = 40;
    await vi.waitFor(() => {
      expect(page.comments.value.map((entry) => entry.body)).toEqual(["今のTaskのコメント"]);
    });
    resolvePreviousTaskList([structuredClone(ownComment)]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(page.comments.value.map((entry) => entry.body)).toEqual(["今のTaskのコメント"]);
    expect(page.isLoading.value).toBe(false);
  });

  it("本人コメントだけを編集・削除可能と判定し、参照専用では本人も変更不可にする", async () => {
    const page = createPage();
    await waitForInitialLoad();

    expect(page.canModifyComment(ownComment)).toBe(true);
    expect(page.canModifyComment(otherComment)).toBe(false);

    const readonlyPage = createPage(true);
    await vi.waitFor(() => {
      expect(readonlyPage.comments.value).toHaveLength(2);
    });
    expect(readonlyPage.canModifyComment(ownComment)).toBe(false);
  });

  it("投稿本文をtrimして送信しBackend確定Responseを一覧へ追加する", async () => {
    const page = createPage();
    await waitForInitialLoad();
    page.commentBody.value = "  新しいコメント  ";

    await page.submitComment();

    expect(mocks.taskCommentApi.createComment).toHaveBeenCalledWith(5, 31, {
      body: "新しいコメント",
    });
    expect(page.comments.value.at(-1)?.commentId).toBe(43);
    expect(page.commentBody.value).toBe("");
  });

  it("編集開始時点のversionを送りBackend確定Responseで対象コメントを置き換える", async () => {
    const page = createPage();
    await waitForInitialLoad();
    page.startEditing(page.comments.value[0]);
    page.editBody.value = "  変更後  ";

    await page.submitEdit();

    expect(mocks.taskCommentApi.updateComment).toHaveBeenCalledWith(5, 31, 41, {
      body: "変更後",
      version: 0,
    });
    expect(page.comments.value[0]).toMatchObject({
      body: "変更後",
      version: 1,
    });
    expect(page.editingCommentId.value).toBeNull();
  });

  it("削除確認対象のversionを送り204成功後だけ一覧から除外する", async () => {
    const page = createPage();
    await waitForInitialLoad();
    page.openDeleteConfirm(page.comments.value[0]);

    await page.confirmDelete();

    expect(mocks.taskCommentApi.deleteComment).toHaveBeenCalledWith(
      5,
      31,
      41,
      0
    );
    expect(page.comments.value.map((comment) => comment.commentId)).toEqual([
      42,
    ]);
    expect(page.deletingComment.value).toBeNull();
  });

  it("409競合では編集状態を破棄して最新一覧を再取得する", async () => {
    const latest = { ...ownComment, body: "別画面の更新", version: 1 };
    mocks.taskCommentApi.findComments
      .mockResolvedValueOnce([structuredClone(ownComment)])
      .mockResolvedValueOnce([latest]);
    mocks.taskCommentApi.updateComment.mockRejectedValue(
      new TaskCommentApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_COMMENT_VERSION_CONFLICT",
            field: "version",
            message: "別の操作でTaskコメントが変更されました。",
          },
        ],
      })
    );
    const page = createPage();
    await waitForInitialLoad();
    page.startEditing(page.comments.value[0]);
    page.editBody.value = "古い更新";

    await page.submitEdit();

    expect(mocks.taskCommentApi.findComments).toHaveBeenCalledTimes(2);
    expect(page.comments.value).toEqual([latest]);
    expect(page.editingCommentId.value).toBeNull();
    expect(page.editBody.value).toBe("");
    // 画面はすでに最新一覧を表示しているので、Backendの文言に再取得済みの案内を添える。
    expect(page.errorMessages.value).toEqual([
      "別の操作でTaskコメントが変更されました。",
      DISPLAY_MESSAGES.task.comments.conflictReloaded,
    ]);
  });

  it("削除の409でBackendの文言を表示できないときは固定の文言と再取得済みの案内を出す", async () => {
    mocks.taskCommentApi.findComments
      .mockResolvedValueOnce([structuredClone(ownComment)])
      .mockResolvedValueOnce([]);
    mocks.taskCommentApi.deleteComment.mockRejectedValue(
      new TaskCommentApiError(409, null)
    );
    const page = createPage();
    await waitForInitialLoad();
    page.openDeleteConfirm(page.comments.value[0]);

    await page.confirmDelete();

    expect(page.comments.value).toEqual([]);
    expect(page.deletingComment.value).toBeNull();
    expect(page.errorMessages.value).toEqual([
      DISPLAY_MESSAGES.task.comments.conflictFallback,
      DISPLAY_MESSAGES.task.comments.conflictReloaded,
    ]);
  });

  it("契約済みcodeの複数項目エラーをBackend順で表示する", async () => {
    mocks.taskCommentApi.createComment.mockRejectedValue(
      new TaskCommentApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "body",
            message: "コメント本文を入力してください。",
          },
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "body",
            message: "コメント本文は2000文字以内で入力してください。",
          },
        ],
      })
    );
    const page = createPage();
    await waitForInitialLoad();
    page.commentBody.value = "投稿内容";

    await page.submitComment();

    expect(page.errorMessages.value).toEqual([
      "コメント本文を入力してください。",
      "コメント本文は2000文字以内で入力してください。",
    ]);
  });

  it("未知codeを含むBackend本文は表示せず固定fallbackへ置き換える", async () => {
    mocks.taskCommentApi.createComment.mockRejectedValue(
      new TaskCommentApiError(500, {
        fieldErrors: [
          {
            errorCode: "INTERNAL_SQL_DETAIL",
            field: "sql",
            message: "公開してはいけない内部情報",
          },
        ],
      })
    );
    const page = createPage();
    await waitForInitialLoad();
    page.commentBody.value = "投稿内容";

    await page.submitComment();

    expect(page.errorMessages.value).toEqual([
      DISPLAY_MESSAGES.task.comments.createFailed,
    ]);
  });

  it("403ではBackend本文を表示せず操作用固定文言を表示してSessionを維持する", async () => {
    mocks.taskCommentApi.createComment.mockRejectedValue(
      new TaskCommentApiError(403, {
        fieldErrors: [
          {
            errorCode: "ACCESS_DENIED",
            field: "permission",
            message: "公開してはいけない認可詳細",
          },
        ],
      })
    );
    const page = createPage();
    await waitForInitialLoad();
    page.commentBody.value = "投稿内容";

    await page.submitComment();

    expect(page.errorMessages.value).toEqual([
      DISPLAY_MESSAGES.task.comments.operationForbidden,
    ]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("409回復中の403を古い競合より優先し一覧と編集状態を破棄する", async () => {
    mocks.taskCommentApi.findComments
      .mockResolvedValueOnce([structuredClone(ownComment)])
      .mockRejectedValueOnce(new TaskCommentApiError(403, null));
    mocks.taskCommentApi.updateComment.mockRejectedValue(
      new TaskCommentApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_COMMENT_VERSION_CONFLICT",
            field: "version",
            message: "別の操作でTaskコメントが変更されました。",
          },
        ],
      })
    );
    const page = createPage();
    await waitForInitialLoad();
    page.startEditing(page.comments.value[0]);
    page.editBody.value = "古い更新";

    await page.submitEdit();

    expect(page.comments.value).toEqual([]);
    expect(page.editingCommentId.value).toBeNull();
    expect(page.errorMessages.value).toEqual([
      DISPLAY_MESSAGES.task.comments.readForbidden,
    ]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("409回復中の通信失敗では元の競合と再取得失敗を区別して表示する", async () => {
    mocks.taskCommentApi.findComments
      .mockResolvedValueOnce([structuredClone(ownComment)])
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    mocks.taskCommentApi.updateComment.mockRejectedValue(
      new TaskCommentApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_COMMENT_VERSION_CONFLICT",
            field: "version",
            message: "別の操作でTaskコメントが変更されました。",
          },
        ],
      })
    );
    const page = createPage();
    await waitForInitialLoad();
    page.startEditing(page.comments.value[0]);
    page.editBody.value = "古い更新";

    await page.submitEdit();

    expect(page.errorMessages.value).toEqual([
      "別の操作でTaskコメントが変更されました。",
      DISPLAY_MESSAGES.task.comments.reloadFailed,
    ]);
  });

  it("更新処理中の再実行ではコメントAPIを二重送信しない", async () => {
    let resolveUpdate;
    mocks.taskCommentApi.updateComment.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );
    const page = createPage();
    await waitForInitialLoad();
    page.startEditing(page.comments.value[0]);
    page.editBody.value = "変更後";

    const first = page.submitEdit();
    const second = page.submitEdit();

    expect(mocks.taskCommentApi.updateComment).toHaveBeenCalledOnce();
    resolveUpdate({ ...ownComment, body: "変更後", version: 1 });
    await Promise.all([first, second]);
  });

  it("401ではSession表示を破棄してLoginへ戻す", async () => {
    mocks.taskCommentApi.findComments.mockRejectedValue(
      new TaskCommentApiError(401, null)
    );

    const page = createPage();
    await waitForInitialLoad();
    await vi.waitFor(() => {
      expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
      expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    });
    expect(page.comments.value).toEqual([]);
    expect(page.errorMessages.value).toEqual([]);
  });

  it.each([
    ["", false],
    ["   ", false],
    ["a".repeat(2000), true],
    ["a".repeat(2001), false],
  ])("本文%#の投稿可否はtrim後の長さで判定する", async (body, expected) => {
    const page = createPage();
    await waitForInitialLoad();

    page.commentBody.value = body;
    page.editBody.value = body;

    expect(page.canSubmit.value).toBe(expected);
    expect(page.canSaveEdit.value).toBe(expected);
  });

  it("参照専用では有効な本文でも投稿できない", async () => {
    const page = createPage(true);
    page.commentBody.value = "確認しました";

    expect(page.canSubmit.value).toBe(false);
  });

  it("削除確認dialogを閉じたときだけ削除対象を破棄する", async () => {
    const page = createPage();
    await waitForInitialLoad();
    page.openDeleteConfirm(ownComment);

    page.handleDeleteDialogVisibility(true);
    expect(page.deletingComment.value).not.toBeNull();
    page.handleDeleteDialogVisibility(false);
    expect(page.deletingComment.value).toBeNull();
  });

  describe("操作後のフォーカス", () => {
    // 単体テストの実行環境にはDOMがないため、部品を探すdocumentを差し替える。
    // 送信中は投稿欄・各ボタンがdisabledになりフォーカスが外れるため、操作後に探し直して戻すことを確かめる。
    const stubDocument = () => {
      const focused = [];
      vi.stubGlobal("document", {
        querySelector: (selector) => {
          const key = selector.match(/data-comment-control="([^"]+)"/)?.[1];
          return { focus: () => focused.push(key), matches: () => false };
        },
      });
      return focused;
    };

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("投稿した後、続けて書けるよう投稿欄へフォーカスを戻す", async () => {
      const focused = stubDocument();
      const page = createPage();
      await waitForInitialLoad();
      page.commentBody.value = "続けて書く";

      await page.submitComment();

      expect(focused).toEqual([COMMENT_COMPOSER_CONTROL]);
    });

    it("投稿に失敗した場合も投稿欄へフォーカスを戻す", async () => {
      mocks.taskCommentApi.createComment.mockRejectedValue(new TypeError("Failed to fetch"));
      const focused = stubDocument();
      const page = createPage();
      await waitForInitialLoad();
      page.commentBody.value = "送れない本文";

      await page.submitComment();

      expect(page.commentBody.value).toBe("送れない本文");
      expect(focused).toEqual([COMMENT_COMPOSER_CONTROL]);
    });

    it("更新した後、そのコメントの編集ボタンへフォーカスを戻す", async () => {
      const focused = stubDocument();
      const page = createPage();
      await waitForInitialLoad();
      page.startEditing(page.comments.value[0]);
      page.editBody.value = "変更後";

      await page.submitEdit();

      expect(page.editingCommentId.value).toBeNull();
      expect(focused).toEqual([buildCommentEditControlKey(41)]);
    });

    it("更新に失敗して編集欄が残る場合は、フォーカスを動かさない", async () => {
      mocks.taskCommentApi.updateComment.mockRejectedValue(new TypeError("Failed to fetch"));
      const focused = stubDocument();
      const page = createPage();
      await waitForInitialLoad();
      page.startEditing(page.comments.value[0]);
      page.editBody.value = "変更後";

      await page.submitEdit();

      expect(page.editingCommentId.value).toBe(41);
      expect(focused).toEqual([]);
    });

    it("キャンセル・Escで編集をやめると、本文を捨てて編集ボタンへフォーカスを戻す", async () => {
      const focused = stubDocument();
      const page = createPage();
      await waitForInitialLoad();
      page.startEditing(page.comments.value[0]);
      page.editBody.value = "保存しない本文";

      await page.discardEditing();

      expect(page.editingCommentId.value).toBeNull();
      expect(page.editBody.value).toBe("");
      expect(mocks.taskCommentApi.updateComment).not.toHaveBeenCalled();
      expect(focused).toEqual([buildCommentEditControlKey(41)]);
    });
  });
});
