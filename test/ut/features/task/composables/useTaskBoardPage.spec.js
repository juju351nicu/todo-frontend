import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectApiError } from "@/features/project/api/projectApi";
import { ProjectTaskApiError } from "@/features/task/api/projectTaskApi";
import { useTaskBoardPage } from "@/features/task/composables/useTaskBoardPage";

const mocks = vi.hoisted(() => ({
  permissions: new Set(),
  projectApi: { getProject: vi.fn(), getTaskBoard: vi.fn() },
  projectTaskApi: {
    archiveTask: vi.fn(),
    createTask: vi.fn(),
    getTask: vi.fn(),
    moveTask: vi.fn(),
    updateTask: vi.fn(),
  },
  route: { params: { projectId: "5" }, query: {} },
  router: { push: vi.fn() },
  userStore: {
    memberId: 2,
    clearSession: vi.fn(),
    hasPermission: vi.fn((code) => mocks.permissions.has(code)),
    hasRole: vi.fn(() => false),
  },
}));

vi.mock("vue-router", () => ({
  useRoute: () => mocks.route,
  useRouter: () => mocks.router,
}));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/project/api/projectApi", async () => {
  const actual = await vi.importActual("@/features/project/api/projectApi");
  return { ...actual, default: mocks.projectApi };
});
vi.mock("@/features/task/api/projectTaskApi", async () => {
  const actual = await vi.importActual("@/features/task/api/projectTaskApi");
  return { ...actual, default: mocks.projectTaskApi };
});

const project = {
  projectId: 5,
  projectKey: "DEMO",
  name: "開発Project",
  description: "Boardテスト",
  status: "ACTIVE",
  projectRole: "MEMBER",
  createdBy: 1,
  createdAt: "2026-08-14T00:00:00Z",
  updatedAt: "2026-08-14T00:00:00Z",
  version: 1,
  members: [
    {
      accountId: 2,
      projectRole: "MEMBER",
      joinedAt: "2026-08-14T00:00:00Z",
      assignedBy: 1,
      version: 1,
      displayName: "参加 二郎",
      accountStatus: "ACTIVE",
    },
  ],
  taskStatuses: [
    {
      taskStatusId: 11,
      statusCode: "TODO",
      name: "Todo",
      position: 1024,
      completed: false,
      version: 1,
    },
  ],
};

const task = {
  taskId: 31,
  projectId: 5,
  taskStatusId: 11,
  title: "既存Task",
  detail: "詳細",
  dateFrom: "2026-08-14",
  dateTo: "2026-08-15",
  assigneeAccountId: 2,
  priority: 2,
  taskType: "TASK",
  position: 1024,
  archived: false,
  createdBy: 2,
  createdAt: "2026-08-14T00:00:00Z",
  updatedAt: "2026-08-14T00:00:00Z",
  version: 4,
};

const board = {
  projectId: 5,
  projectName: "開発Project",
  columns: [{ ...project.taskStatuses[0], tasks: [task] }],
};

const ownerProject = {
  ...project,
  projectRole: "OWNER",
  members: [{ ...project.members[0], projectRole: "OWNER" }],
};

const destinationTask = {
  ...task,
  taskId: 40,
  title: "移動先Task",
  position: 1024,
  version: 2,
};

const precedingTask = {
  ...task,
  taskId: 30,
  title: "直前Task",
  position: 512,
  version: 3,
};

const movableBoard = {
  projectId: 5,
  projectName: "開発Project",
  columns: [
    { ...project.taskStatuses[0], tasks: [task] },
    {
      taskStatusId: 12,
      statusCode: "IN_PROGRESS",
      name: "進行中",
      position: 2048,
      completed: false,
      version: 1,
      tasks: [destinationTask],
    },
  ],
};

const keyboardBoard = {
  ...movableBoard,
  columns: [
    { ...project.taskStatuses[0], tasks: [precedingTask, task] },
    movableBoard.columns[1],
    {
      taskStatusId: 13,
      statusCode: "DONE",
      name: "完了",
      position: 3072,
      completed: true,
      version: 1,
      tasks: [],
    },
  ],
};

describe("useTaskBoardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions.clear();
    mocks.permissions.add("TASK_READ");
    mocks.permissions.add("TASK_CREATE");
    mocks.permissions.add("TASK_UPDATE");
    mocks.permissions.add("TASK_MOVE");
    mocks.permissions.add("TASK_ARCHIVE");
    mocks.route.params.projectId = "5";
    mocks.route.query = {};
    mocks.router.push.mockResolvedValue(undefined);
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(project));
    mocks.projectApi.getTaskBoard.mockResolvedValue(structuredClone(board));
    mocks.projectTaskApi.getTask.mockResolvedValue(task);
    mocks.projectTaskApi.archiveTask.mockResolvedValue(undefined);
    mocks.projectTaskApi.createTask.mockResolvedValue(task);
    mocks.projectTaskApi.moveTask.mockResolvedValue(structuredClone(movableBoard));
    mocks.projectTaskApi.updateTask.mockResolvedValue({ ...task, version: 5 });
  });

  it("初期表示でProject詳細とBoardを並行取得する", async () => {
    const page = useTaskBoardPage();

    await page.initialize();

    expect(mocks.projectApi.getProject).toHaveBeenCalledWith(5);
    expect(mocks.projectApi.getTaskBoard).toHaveBeenCalledWith(5);
    expect(page.project.value).toEqual(project);
    expect(page.board.value).toEqual(board);
  });

  it("Task ID query付きの初期表示でTask詳細Dialogを開く", async () => {
    mocks.route.query = { taskId: "31" };
    const page = useTaskBoardPage();

    await page.initialize();

    expect(mocks.projectTaskApi.getTask).toHaveBeenCalledWith(5, 31);
    expect(page.form.value.taskId).toBe(31);
    expect(page.isEditorOpen.value).toBe(true);
    expect(page.canStartTaskTimer.value).toBe(true);
  });

  it.each(["SUMMARY", "MILESTONE"])(
    "%sのTaskはTimer・日別実績の入口を出さない（実績工数は通常Taskだけ）",
    async (taskType) => {
      mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
      mocks.projectTaskApi.getTask.mockResolvedValue({ ...structuredClone(task), taskType });
      const page = useTaskBoardPage();
      await page.initialize();

      await page.openTaskEditor(31);

      expect(page.isEditorOpen.value).toBe(true);
      expect(page.canRecordTaskWork.value).toBe(false);
      expect(page.canStartTaskTimer.value).toBe(false);
      // Task Templateへの保存も通常Taskだけ（Backendが400で拒否する）。
      expect(page.canCaptureTaskTemplate.value).toBe(false);
    }
  );

  it("通常TaskではOWNERにTimer・日別実績の入口を出す", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    const page = useTaskBoardPage();
    await page.initialize();

    await page.openTaskEditor(31);

    expect(page.canRecordTaskWork.value).toBe(true);
    expect(page.canStartTaskTimer.value).toBe(true);
    expect(page.canCaptureTaskTemplate.value).toBe(true);
  });

  it("Task Template適用の担当者は、MEMBERなら本人だけに限定し、OWNERなら限定しない", async () => {
    const memberPage = useTaskBoardPage();
    await memberPage.initialize();
    expect(memberPage.taskTemplateAssigneeAccountId.value).toBe(mocks.userStore.memberId);

    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    const ownerPage = useTaskBoardPage();
    await ownerPage.initialize();
    expect(ownerPage.taskTemplateAssigneeAccountId.value).toBeNull();
  });

  it("Task詳細から同じTaskの日別実績入力をWBSで開く", async () => {
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);

    await page.openTaskWorkLogs();

    expect(mocks.router.push).toHaveBeenCalledWith({
      name: "Wbs",
      params: { projectId: 5 },
      query: { taskId: "31", panel: "work-logs" },
    });
  });

  it("MEMBERは自分が担当のTaskを編集できる", async () => {
    const page = useTaskBoardPage();
    await page.initialize();

    await page.openTaskEditor(31);

    expect(page.isReadonly.value).toBe(false);
    expect(page.canSave.value).toBe(true);
  });

  it("MEMBERは他人が担当のTaskを参照のみで開き、担当者名を選択肢から表示できる", async () => {
    // Backendは他人が担当のTaskをMEMBERが更新すると403にするため、保存できる見た目にしない。
    mocks.projectApi.getProject.mockResolvedValue({
      ...structuredClone(project),
      members: [
        ...structuredClone(project.members),
        { ...project.members[0], accountId: 1, projectRole: "OWNER", displayName: "管理 一郎" },
      ],
    });
    mocks.projectTaskApi.getTask.mockResolvedValue({ ...task, assigneeAccountId: 1 });
    const page = useTaskBoardPage();
    await page.initialize();

    await page.openTaskEditor(31);

    expect(page.isReadonly.value).toBe(true);
    expect(page.canSave.value).toBe(false);
    expect(page.memberOptions.value.map((option) => option.value)).toContain(1);
  });

  it("MEMBERが担当者欄を自分に変えても、取得時点で他人が担当のTaskは参照のみのままにする", async () => {
    mocks.projectTaskApi.getTask.mockResolvedValue({ ...task, assigneeAccountId: 1 });
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);

    page.form.value.assigneeAccountId = 2;

    expect(page.isReadonly.value).toBe(true);
  });

  it("OWNERは他人が担当のTaskも編集できる", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectTaskApi.getTask.mockResolvedValue({ ...task, assigneeAccountId: 1 });
    const page = useTaskBoardPage();
    await page.initialize();

    await page.openTaskEditor(31);

    expect(page.isReadonly.value).toBe(false);
    expect(page.canSave.value).toBe(true);
  });

  it("MEMBERは自分が担当しないTaskのTimerを開始表示しない", async () => {
    mocks.projectTaskApi.getTask.mockResolvedValue({
      ...task,
      assigneeAccountId: 9,
    });
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);

    expect(page.canStartTaskTimer.value).toBe(false);
  });

  it("列の追加操作から担当者・日付・配置先を初期設定してTaskを登録する", async () => {
    const page = useTaskBoardPage();
    await page.initialize();
    page.openTaskCreator(11);
    page.form.value.title = "新規Task";
    page.form.value.detail = "実装する";

    await page.saveTask();

    expect(mocks.projectTaskApi.createTask).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        title: "新規Task",
        detail: "実装する",
        assigneeAccountId: 2,
        taskStatusId: 11,
        priority: 2,
      })
    );
    expect(mocks.projectApi.getTaskBoard).toHaveBeenCalledTimes(2);
    expect(page.isEditorOpen.value).toBe(false);
  });

  it("Task詳細取得時点のversionを使い、列を含めず更新する", async () => {
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);
    page.form.value.title = "更新Task";

    await page.saveTask();

    expect(mocks.projectTaskApi.getTask).toHaveBeenCalledWith(5, 31);
    expect(mocks.projectTaskApi.updateTask).toHaveBeenCalledWith(5, 31, {
      title: "更新Task",
      detail: "詳細",
      dateFrom: "2026-08-14",
      dateTo: "2026-08-15",
      assigneeAccountId: 2,
      priority: 2,
      version: 4,
    });
  });

  it("保存中の再実行ではTask APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.projectTaskApi.updateTask.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);

    const firstSave = page.saveTask();
    const secondSave = page.saveTask();

    expect(mocks.projectTaskApi.updateTask).toHaveBeenCalledOnce();
    resolveRequest(task);
    await Promise.all([firstSave, secondSave]);
  });

  it("409競合ではBackendメッセージを表示しDialogを閉じて最新Boardを再取得する", async () => {
    mocks.projectTaskApi.updateTask.mockRejectedValue(
      new ProjectTaskApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_VERSION_CONFLICT",
            field: "version",
            message: "他の操作で更新されています。",
          },
        ],
      })
    );
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);

    await page.saveTask();

    expect(page.errorMessages.value).toEqual([
      "他の操作で更新されています。",
      // 画面側で最新Boardを再取得済みであることも添える。
      "最新のProject Boardを再取得しました。内容を確認してから、もう一度操作してください。",
    ]);
    expect(page.isEditorOpen.value).toBe(false);
    expect(mocks.projectApi.getTaskBoard).toHaveBeenCalledTimes(2);
  });

  it("契約済みの複数入力エラーをBackend順でtrimして表示する", async () => {
    mocks.projectTaskApi.createTask.mockRejectedValue(
      new ProjectTaskApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "title",
            message: " タイトルは45文字以内で入力してください。 ",
          },
          {
            errorCode: "INVALID_TASK_SCHEDULE",
            field: "dateTo",
            message: "期限は開始日以降の日付を指定してください。",
          },
        ],
      })
    );
    const page = useTaskBoardPage();
    await page.initialize();
    page.openTaskCreator(11);
    page.form.value.title = "新規Task";
    page.form.value.detail = "詳細";

    await page.saveTask();

    expect(page.editorErrorMessages.value).toEqual([
      "タイトルは45文字以内で入力してください。",
      "期限は開始日以降の日付を指定してください。",
    ]);
    expect(page.isEditorOpen.value).toBe(true);
  });

  it("未知codeのBackend messageを表示せずTask保存fallbackへ閉じる", async () => {
    mocks.projectTaskApi.updateTask.mockRejectedValue(
      new ProjectTaskApiError(500, {
        fieldErrors: [
          {
            errorCode: "INTERNAL_TASK_DETAIL",
            field: "taskId",
            message: "内部Task情報を含む文言",
          },
        ],
      })
    );
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);

    await page.saveTask();

    expect(page.editorErrorMessages.value).toEqual([
      "Taskを保存できませんでした。",
    ]);
    expect(page.editorErrorMessages.value).not.toContain("内部Task情報を含む文言");
  });

  it("本文なし403はSessionを維持してTask操作権限不足を表示する", async () => {
    mocks.projectTaskApi.updateTask.mockRejectedValue(
      new ProjectTaskApiError(403, null)
    );
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);

    await page.saveTask();

    expect(page.editorErrorMessages.value).toEqual([
      "このTask操作を実行するpermissionがありません。",
    ]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("入力チェックの結果はTask Dialog内に出し、画面上部（Dialogの裏）には出さない", async () => {
    const page = useTaskBoardPage();
    await page.initialize();
    page.openTaskCreator(11);
    page.form.value.title = "期限の確認";
    page.form.value.detail = "詳細";
    page.form.value.dateFrom = "2026-10-30";
    page.form.value.dateTo = "2026-10-29";

    await page.saveTask();

    expect(page.editorErrorMessages.value).toEqual(["終了日は開始日以降にしてください。"]);
    expect(page.errorMessages.value).toEqual([]);
    expect(page.isEditorOpen.value).toBe(true);
  });

  it("Task保存確定後のBoard再取得失敗を保存失敗として誤表示しない", async () => {
    mocks.projectApi.getProject
      .mockResolvedValueOnce(structuredClone(project))
      .mockRejectedValueOnce(new TypeError("network"));
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);

    await page.saveTask();

    expect(page.successMessage.value).toBe("Taskを更新しました。");
    expect(page.errorMessages.value).toEqual([
      "Taskは保存されましたが、最新のProject Boardを取得できませんでした。",
    ]);
    expect(page.errorMessages.value).not.toContain("Taskを保存できませんでした。");
  });

  it("Task保存確定後のBoard再取得401は古い画面を破棄してLoginへ戻る", async () => {
    mocks.projectApi.getProject
      .mockResolvedValueOnce(structuredClone(project))
      .mockRejectedValueOnce(new ProjectApiError(401, null));
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);

    await page.saveTask();

    expect(page.errorMessages.value).toEqual([]);
    expect(page.project.value).toBeNull();
    expect(page.board.value).toBeNull();
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it.each([
    [403, "Project BoardまたはTaskを参照するpermissionがありません。"],
    [404, "対象のProjectまたはTaskが見つかりません。"],
  ])(
    "409回復中の%dは古い競合案内より現在の参照状態を優先する",
    async (status, expectedMessage) => {
      mocks.projectTaskApi.updateTask.mockRejectedValue(
        new ProjectTaskApiError(409, {
          fieldErrors: [
            {
              errorCode: "TASK_VERSION_CONFLICT",
              field: "version",
              message: "Taskが先に更新されています。",
            },
          ],
        })
      );
      mocks.projectApi.getProject
        .mockResolvedValueOnce(structuredClone(project))
        .mockRejectedValueOnce(new ProjectApiError(status, null));
      const page = useTaskBoardPage();
      await page.initialize();
      await page.openTaskEditor(31);

      await page.saveTask();

      expect(page.errorMessages.value).toEqual([expectedMessage]);
      expect(page.project.value).toBeNull();
      expect(page.board.value).toBeNull();
      expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
    }
  );

  it("409回復中の401は競合案内と古いBoardを破棄してLoginへ戻る", async () => {
    mocks.projectTaskApi.updateTask.mockRejectedValue(
      new ProjectTaskApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_VERSION_CONFLICT",
            field: "version",
            message: "Taskが先に更新されています。",
          },
        ],
      })
    );
    mocks.projectApi.getProject
      .mockResolvedValueOnce(structuredClone(project))
      .mockRejectedValueOnce(new ProjectApiError(401, null));
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);

    await page.saveTask();

    expect(page.errorMessages.value).toEqual([]);
    expect(page.project.value).toBeNull();
    expect(page.board.value).toBeNull();
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("409回復の通信失敗では競合理由を維持して再取得失敗を追加する", async () => {
    mocks.projectTaskApi.updateTask.mockRejectedValue(
      new ProjectTaskApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_VERSION_CONFLICT",
            field: "version",
            message: "Taskが先に更新されています。",
          },
        ],
      })
    );
    mocks.projectApi.getProject
      .mockResolvedValueOnce(structuredClone(project))
      .mockRejectedValueOnce(new TypeError("network"));
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);

    await page.saveTask();

    expect(page.errorMessages.value).toEqual([
      "Taskが先に更新されています。",
      "最新のProject Boardを再取得できませんでした。",
    ]);
  });

  it("401はSessionを破棄してログインへ戻す", async () => {
    mocks.projectApi.getProject.mockRejectedValue(new ProjectApiError(401, null));
    const page = useTaskBoardPage();

    await page.initialize();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("Board取得の本文なし403は古い画面を破棄して参照権限不足を表示する", async () => {
    mocks.projectApi.getTaskBoard.mockRejectedValue(
      new ProjectApiError(403, null)
    );
    const page = useTaskBoardPage();

    await page.initialize();

    expect(page.errorMessages.value).toEqual([
      "Project BoardまたはTaskを参照するpermissionがありません。",
    ]);
    expect(page.project.value).toBeNull();
    expect(page.board.value).toBeNull();
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("MEMBERはTASK_MOVE permissionを持っていてもドラッグできない", async () => {
    const page = useTaskBoardPage();

    await page.initialize();

    expect(page.canMoveTask.value).toBe(false);
  });

  it("MEMBERはTASK_ARCHIVE permissionを持っていてもarchiveできない", async () => {
    const page = useTaskBoardPage();

    await page.initialize();

    expect(page.canArchiveTask.value).toBe(false);
  });

  it("コメントの投稿はBackendと同じくTASK_READだけで許可し、TASK_UPDATEを問わない", async () => {
    mocks.permissions.clear();
    mocks.permissions.add("TASK_READ");
    const page = useTaskBoardPage();

    await page.initialize();

    expect(page.canUpdateTask.value).toBe(false);
    expect(page.canPostTaskComment.value).toBe(true);
  });

  it("TASK_READがない、またはarchive済みProjectではコメントを投稿できない", async () => {
    mocks.permissions.delete("TASK_READ");
    const page = useTaskBoardPage();
    await page.initialize();
    expect(page.canPostTaskComment.value).toBe(false);

    mocks.permissions.add("TASK_READ");
    mocks.projectApi.getProject.mockResolvedValue({ ...structuredClone(ownerProject), status: "ARCHIVED" });
    const archivedPage = useTaskBoardPage();
    await archivedPage.initialize();
    expect(archivedPage.canPostTaskComment.value).toBe(false);
  });

  it("MEMBERはTask permissionを持っていても繰り返し規則を変更できない", async () => {
    const page = useTaskBoardPage();

    await page.initialize();

    expect(page.canCreateTaskRecurrence.value).toBe(false);
    expect(page.canUpdateTaskRecurrence.value).toBe(false);
  });

  it("OWNERはTask permissionとACTIVE Projectで繰り返し規則を変更できる", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    const page = useTaskBoardPage();

    await page.initialize();

    expect(page.canCreateTaskRecurrence.value).toBe(true);
    expect(page.canUpdateTaskRecurrence.value).toBe(true);
  });

  it("OWNERはPROJECT_CREATE permissionとACTIVE ProjectでProject Templateをcaptureできる", async () => {
    mocks.permissions.add("PROJECT_CREATE");
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    const page = useTaskBoardPage();

    await page.initialize();

    expect(page.canCaptureProjectTemplate.value).toBe(true);
  });

  it("MEMBERはPROJECT_CREATE permissionがあってもProject Templateをcaptureできない", async () => {
    mocks.permissions.add("PROJECT_CREATE");
    const page = useTaskBoardPage();

    await page.initialize();

    expect(page.canCaptureProjectTemplate.value).toBe(false);
  });

  it("OWNERは確認後にTaskをversion付きでarchiveして最新Boardを取得する", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);
    page.openArchiveConfirm();

    await page.archiveTask();

    expect(mocks.projectTaskApi.archiveTask).toHaveBeenCalledWith(5, 31, 4);
    expect(mocks.projectApi.getTaskBoard).toHaveBeenCalledTimes(2);
    expect(page.isArchiveConfirmOpen.value).toBe(false);
    expect(page.isEditorOpen.value).toBe(false);
    expect(page.successMessage.value).toBe("Taskをアーカイブしました。");
  });

  it("archive確定後のBoard再取得失敗をarchive失敗として誤表示しない", async () => {
    mocks.projectApi.getProject
      .mockResolvedValueOnce(structuredClone(ownerProject))
      .mockRejectedValueOnce(new TypeError("network"));
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);
    page.openArchiveConfirm();

    await page.archiveTask();

    expect(page.successMessage.value).toBe("Taskをアーカイブしました。");
    expect(page.errorMessages.value).toEqual([
      "Taskはアーカイブされましたが、最新のProject Boardを取得できませんでした。",
    ]);
    expect(page.errorMessages.value).not.toContain(
      "Taskをアーカイブできませんでした。"
    );
  });

  it("archive実行中の再実行ではDELETE APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectTaskApi.archiveTask.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);
    page.openArchiveConfirm();

    const firstArchive = page.archiveTask();
    const secondArchive = page.archiveTask();

    expect(mocks.projectTaskApi.archiveTask).toHaveBeenCalledOnce();
    resolveRequest();
    await Promise.all([firstArchive, secondArchive]);
  });

  it("archiveの409競合では古いDialogを閉じて最新Boardを再取得する", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectTaskApi.archiveTask.mockRejectedValue(
      new ProjectTaskApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_VERSION_CONFLICT",
            field: "version",
            message: "Taskが先に更新されています。",
          },
        ],
      })
    );
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);
    page.openArchiveConfirm();

    await page.archiveTask();

    expect(page.errorMessages.value).toEqual([
      "Taskが先に更新されています。",
      // 画面側で最新Boardを再取得済みであることも添える。
      "最新のProject Boardを再取得しました。内容を確認してから、もう一度操作してください。",
    ]);
    expect(page.isArchiveConfirmOpen.value).toBe(false);
    expect(page.isEditorOpen.value).toBe(false);
    expect(mocks.projectApi.getTaskBoard).toHaveBeenCalledTimes(2);
  });

  it("OWNERが別列の末尾へ移動すると直前Taskと移動前versionを送信する", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectApi.getTaskBoard.mockResolvedValue(structuredClone(movableBoard));
    const confirmedBoard = {
      ...movableBoard,
      columns: movableBoard.columns.map((column) => ({
        ...column,
        tasks:
          column.taskStatusId === 11
            ? []
            : [destinationTask, { ...task, version: 5 }],
      })),
    };
    mocks.projectTaskApi.moveTask.mockResolvedValue(confirmedBoard);
    const page = useTaskBoardPage();
    await page.initialize();
    page.startTaskDrag();
    const movedTask = page.board.value.columns[0].tasks.shift();
    page.board.value.columns[1].tasks.push(movedTask);

    await page.handleTaskDrop(
      { added: { element: movedTask, newIndex: 1 } },
      12
    );

    expect(mocks.projectTaskApi.moveTask).toHaveBeenCalledWith(5, 31, {
      destinationStatusId: 12,
      previousTaskId: 40,
      nextTaskId: null,
      version: 4,
    });
    expect(page.board.value).toEqual(confirmedBoard);
    expect(page.successMessage.value).toBe("Taskを移動しました。");
  });

  it.each([
    ["上キー", 31, "UP", 11, null, 30, 4],
    ["下キー", 30, "DOWN", 11, 31, null, 3],
    ["右キー", 31, "RIGHT", 12, 40, null, 4],
    ["左キー", 40, "LEFT", 11, 31, null, 2],
  ])(
    "%sでTaskの前後関係を計算して移動APIへ送信する",
    async (
      _keyName,
      taskId,
      direction,
      destinationStatusId,
      previousTaskId,
      nextTaskId,
      version
    ) => {
      mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
      mocks.projectApi.getTaskBoard.mockResolvedValue(
        structuredClone(keyboardBoard)
      );
      const page = useTaskBoardPage();
      await page.initialize();

      await page.moveTaskByKeyboard(taskId, direction);

      expect(mocks.projectTaskApi.moveTask).toHaveBeenCalledWith(5, taskId, {
        destinationStatusId,
        previousTaskId,
        nextTaskId,
        version,
      });
      expect(page.successMessage.value).toBe("Taskを移動しました。");
    }
  );

  it("方向キーで移動した後、移動したTaskの移動アイコンへフォーカスを戻す", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectApi.getTaskBoard.mockResolvedValue(structuredClone(keyboardBoard));
    // 単体テストの実行環境にはDOMがないため、Board画面の移動アイコンを探すdocumentを差し替える。
    // 移動中はアイコンがdisabledになりフォーカスが外れるため、移動後に探し直して戻すことを確かめる。
    const focus = vi.fn();
    const querySelector = vi.fn(() => ({ focus, matches: () => false }));
    vi.stubGlobal("document", { querySelector });
    try {
      const page = useTaskBoardPage();
      await page.initialize();

      await page.moveTaskByKeyboard(31, "RIGHT");

      expect(querySelector).toHaveBeenCalledWith('[data-task-move-handle="31"]');
      expect(focus).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("先頭Taskの上・左方向では移動APIを送信しない", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectApi.getTaskBoard.mockResolvedValue(structuredClone(keyboardBoard));
    const page = useTaskBoardPage();
    await page.initialize();

    await page.moveTaskByKeyboard(30, "UP");
    await page.moveTaskByKeyboard(30, "LEFT");

    expect(mocks.projectTaskApi.moveTask).not.toHaveBeenCalled();
  });

  it("MEMBERの方向キー操作では移動APIを送信しない", async () => {
    mocks.projectApi.getTaskBoard.mockResolvedValue(structuredClone(keyboardBoard));
    const page = useTaskBoardPage();
    await page.initialize();

    await page.moveTaskByKeyboard(31, "RIGHT");

    expect(mocks.projectTaskApi.moveTask).not.toHaveBeenCalled();
  });

  it("方向キー移動の409競合ではBackendの最新Boardを再取得する", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectApi.getTaskBoard
      .mockResolvedValueOnce(structuredClone(keyboardBoard))
      .mockResolvedValueOnce(structuredClone(board));
    mocks.projectTaskApi.moveTask.mockRejectedValue(
      new ProjectTaskApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_VERSION_CONFLICT",
            field: "version",
            message: "移動中にTaskが更新されました。",
          },
        ],
      })
    );
    const page = useTaskBoardPage();
    await page.initialize();

    await page.moveTaskByKeyboard(31, "RIGHT");

    expect(page.errorMessages.value).toEqual([
      "移動中にTaskが更新されました。",
      // 画面側で最新Boardを再取得済みであることも添える。
      "最新のProject Boardを再取得しました。内容を確認してから、もう一度操作してください。",
    ]);
    expect(mocks.projectApi.getTaskBoard).toHaveBeenCalledTimes(2);
    expect(page.board.value).toEqual(board);
  });

  it("source列のremoved eventでは移動APIを送信しない", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectApi.getTaskBoard.mockResolvedValue(structuredClone(movableBoard));
    const page = useTaskBoardPage();
    await page.initialize();

    await page.handleTaskDrop(
      { removed: { element: task, newIndex: 0 } },
      11
    );

    expect(mocks.projectTaskApi.moveTask).not.toHaveBeenCalled();
  });

  it("403で移動できない場合はドラッグ前の列と順序へ戻す", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectApi.getTaskBoard.mockResolvedValue(structuredClone(movableBoard));
    mocks.projectTaskApi.moveTask.mockRejectedValue(
      new ProjectTaskApiError(403, null)
    );
    const page = useTaskBoardPage();
    await page.initialize();
    const beforeDrag = JSON.parse(JSON.stringify(page.board.value));
    page.startTaskDrag();
    const movedTask = page.board.value.columns[0].tasks.shift();
    page.board.value.columns[1].tasks.push(movedTask);

    await page.handleTaskDrop(
      { added: { element: movedTask, newIndex: 1 } },
      12
    );

    expect(page.board.value).toEqual(beforeDrag);
    expect(page.errorMessages.value).toEqual([
      "このTask操作を実行するpermissionがありません。",
    ]);
  });

  it("409競合では楽観表示を破棄してBackendの最新Boardを再取得する", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectApi.getTaskBoard
      .mockResolvedValueOnce(structuredClone(movableBoard))
      .mockResolvedValueOnce(structuredClone(board));
    mocks.projectTaskApi.moveTask.mockRejectedValue(
      new ProjectTaskApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_POSITION_CONFLICT",
            field: "version",
            message: "移動中にTaskが更新されました。",
          },
        ],
      })
    );
    const page = useTaskBoardPage();
    await page.initialize();
    page.startTaskDrag();
    const movedTask = page.board.value.columns[0].tasks.shift();
    page.board.value.columns[1].tasks.push(movedTask);

    await page.handleTaskDrop(
      { added: { element: movedTask, newIndex: 1 } },
      12
    );

    expect(page.errorMessages.value).toEqual([
      "移動中にTaskが更新されました。",
      // 画面側で最新Boardを再取得済みであることも添える。
      "最新のProject Boardを再取得しました。内容を確認してから、もう一度操作してください。",
    ]);
    expect(mocks.projectApi.getTaskBoard).toHaveBeenCalledTimes(2);
    expect(page.board.value).toEqual(board);
  });
});
