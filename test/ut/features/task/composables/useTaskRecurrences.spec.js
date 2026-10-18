import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskRecurrenceApiError } from "@/features/task/api/taskRecurrenceApi";
import { useTaskRecurrences } from "@/features/task/composables/useTaskRecurrences";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  taskRecurrenceApi: {
    archive: vi.fn(),
    create: vi.fn(),
    createFromTemplate: vi.fn(),
    findGenerations: vi.fn(),
    findRules: vi.fn(),
    retryGeneration: vi.fn(),
    update: vi.fn(),
  },
  taskTemplateApi: { findOwnTemplates: vi.fn() },
  userStore: { clearSession: vi.fn() },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/task/api/taskRecurrenceApi", async () => {
  const actual = await vi.importActual("@/features/task/api/taskRecurrenceApi");
  return { ...actual, default: mocks.taskRecurrenceApi };
});
vi.mock("@/features/task/api/taskTemplateApi", async () => {
  const actual = await vi.importActual("@/features/task/api/taskTemplateApi");
  return { ...actual, default: mocks.taskTemplateApi };
});

const rule = {
  taskRecurrenceRuleId: 71,
  projectId: 5,
  ownerAccountId: 2,
  title: "週次確認",
  detail: "状況を確認する",
  priority: 2,
  plannedEffortMinutes: 30,
  dueOffsetDays: 1,
  assigneeAccountId: 2,
  taskStatusId: 11,
  frequency: "WEEKLY",
  intervalCount: 1,
  weekdays: ["MONDAY"],
  monthlyDay: null,
  firstOccurrenceDate: "2026-09-21",
  nextOccurrenceDate: "2026-09-28",
  endDate: null,
  generationLeadDays: 2,
  status: "ACTIVE",
  blockedReason: null,
  sourceTaskTemplateId: null,
  checklistItems: [{ content: "集計", position: 1000 }],
  createdAt: "2026-09-21T00:00:00Z",
  updatedAt: "2026-09-21T00:00:00Z",
  version: 3,
};
const failedGeneration = {
  taskRecurrenceGenerationId: 91,
  taskRecurrenceRuleId: 71,
  occurrenceDate: "2026-09-21",
  status: "FAILED",
  generatedProjectId: null,
  generatedTaskId: null,
  attemptCount: 5,
  nextRetryAt: null,
  lastErrorCode: "RETRY_EXHAUSTED",
  createdAt: "2026-09-21T00:00:00Z",
  updatedAt: "2026-09-21T01:00:00Z",
};
const template = { taskTemplateId: 81, name: "週次確認Template" };

const createPage = () => useTaskRecurrences(ref(5));

describe("useTaskRecurrences", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 21, 12, 0, 0));
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.taskRecurrenceApi.findRules.mockResolvedValue([
      structuredClone(rule),
    ]);
    mocks.taskRecurrenceApi.findGenerations.mockResolvedValue([
      structuredClone(failedGeneration),
    ]);
    mocks.taskRecurrenceApi.create.mockResolvedValue({ ...rule, taskRecurrenceRuleId: 72, version: 0 });
    mocks.taskRecurrenceApi.createFromTemplate.mockResolvedValue({
      ...rule,
      taskRecurrenceRuleId: 73,
      sourceTaskTemplateId: 81,
      version: 0,
    });
    mocks.taskRecurrenceApi.update.mockResolvedValue({ ...rule, status: "PAUSED", version: 4 });
    mocks.taskRecurrenceApi.archive.mockResolvedValue(undefined);
    mocks.taskRecurrenceApi.retryGeneration.mockResolvedValue({
      ...failedGeneration,
      status: "PENDING",
      attemptCount: 0,
      lastErrorCode: null,
    });
    mocks.taskTemplateApi.findOwnTemplates.mockResolvedValue([template]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("archive済みを含む規則一覧を取得する", async () => {
    const page = createPage();

    await page.loadRules();

    expect(mocks.taskRecurrenceApi.findRules).toHaveBeenCalledWith(5);
    expect(page.rules.value).toEqual([rule]);
  });

  it("規則選択時に独立draftと生成履歴を読み込む", async () => {
    const page = createPage();
    await page.loadRules();

    await page.selectRule(page.rules.value[0]);
    page.form.value.weekdays.push("FRIDAY");

    expect(mocks.taskRecurrenceApi.findGenerations).toHaveBeenCalledWith(5, 71);
    expect(page.generations.value).toEqual([failedGeneration]);
    expect(page.rules.value[0].weekdays).toEqual(["MONDAY"]);
  });

  it("直接入力をtrimし、頻度に不要なschedule値を除いて作成する", async () => {
    const page = createPage();
    page.beginCreating(2, 11);
    page.form.value.title = "  日次確認  ";
    page.form.value.detail = "  確認する  ";
    page.form.value.firstOccurrenceDate = "2026-09-22";
    page.form.value.frequency = "DAILY";
    page.form.value.weekdays = ["MONDAY"];
    page.form.value.monthlyDay = 10;
    page.form.value.checklistContents = ["  集計  "];

    await page.createRule();

    expect(mocks.taskRecurrenceApi.create).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        title: "日次確認",
        detail: "確認する",
        weekdays: [],
        monthlyDay: null,
        checklistItems: [{ content: "集計" }],
      })
    );
    expect(page.selectedRule.value.taskRecurrenceRuleId).toBe(72);
    expect(page.isCreating.value).toBe(false);
  });

  it("本人所有Templateと任意上書き値から規則を作成する", async () => {
    const page = createPage();
    page.beginCreating(null, null);
    page.creationMode.value = "TEMPLATE";
    page.form.value.taskTemplateId = 81;
    page.form.value.taskStatusId = 11;
    page.form.value.firstOccurrenceDate = "2026-09-22";

    await page.createRule();

    expect(mocks.taskRecurrenceApi.createFromTemplate).toHaveBeenCalledWith(5, {
      taskTemplateId: 81,
      assigneeAccountId: null,
      taskStatusId: 11,
      frequency: "DAILY",
      intervalCount: 1,
      weekdays: [],
      monthlyDay: null,
      firstOccurrenceDate: "2026-09-22",
      endDate: null,
      generationLeadDays: 0,
    });
  });

  it("週次で曜日未選択ならAPIを呼ばず入力エラーを表示する", async () => {
    const page = createPage();
    page.beginCreating(2, 11);
    page.form.value.title = "週次確認";
    page.form.value.detail = "確認する";
    page.form.value.firstOccurrenceDate = "2026-09-22";
    page.form.value.frequency = "WEEKLY";

    await page.createRule();

    expect(mocks.taskRecurrenceApi.create).not.toHaveBeenCalled();
    expect(page.errorMessage.value).toBe("週次では曜日を1つ以上選択してください。");
  });

  it("機能資格403ではBackendメッセージを表示して作成draftを保持する", async () => {
    mocks.taskRecurrenceApi.create.mockRejectedValue(
      new TaskRecurrenceApiError(403, {
        fieldErrors: [
          {
            field: "featureCode",
            errorCode: "FEATURE_NOT_ENTITLED",
            message: "現在のPlanでは利用できません。",
          },
        ],
      })
    );
    const page = createPage();
    page.beginCreating(2, 11);
    page.form.value.title = "日次確認";
    page.form.value.detail = "確認する";
    page.form.value.firstOccurrenceDate = "2026-09-22";

    await page.createRule();

    expect(page.errorMessage.value).toBe("現在のPlanでは利用できません。");
    expect(page.isCreating.value).toBe(true);
  });

  it("permission 403ではBackend本文を表示せず固定文言で作成draftを保持する", async () => {
    mocks.taskRecurrenceApi.create.mockRejectedValue(
      new TaskRecurrenceApiError(403, {
        fieldErrors: [
          {
            field: "permission",
            errorCode: "FEATURE_NOT_ENTITLED",
            message: "featureCode以外の表示禁止文言",
          },
        ],
      })
    );
    const page = createPage();
    page.beginCreating(2, 11);
    page.form.value.title = "日次確認";
    page.form.value.detail = "確認する";
    page.form.value.firstOccurrenceDate = "2026-09-22";

    await page.createRule();

    expect(page.errorMessage.value).toBe(
      "この繰り返しTask操作を実行するpermissionがありません。"
    );
    expect(page.isCreating.value).toBe(true);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("契約済み複数error messageをBackend順で表示する", async () => {
    mocks.taskRecurrenceApi.create.mockRejectedValue(
      new TaskRecurrenceApiError(400, {
        fieldErrors: [
          {
            field: "intervalCount",
            errorCode: "RECURRENCE_SCHEDULE_INVALID",
            message: "間隔が不正です。",
          },
          {
            field: "endDate",
            errorCode: "RECURRENCE_SCHEDULE_INVALID",
            message: "終了日が不正です。",
          },
        ],
      })
    );
    const page = createPage();
    page.beginCreating(2, 11);
    page.form.value.title = "日次確認";
    page.form.value.detail = "確認する";
    page.form.value.firstOccurrenceDate = "2026-09-22";

    await page.createRule();

    expect(page.errorMessage.value).toBe(
      "間隔が不正です。\n終了日が不正です。"
    );
  });

  it("BLOCKED規則を修正するとACTIVEと取得時点versionを送信する", async () => {
    const blocked = { ...rule, status: "BLOCKED", blockedReason: "TASK_STATUS_UNAVAILABLE" };
    mocks.taskRecurrenceApi.findRules.mockResolvedValue([blocked]);
    const page = createPage();
    await page.loadRules();
    await page.selectRule(page.rules.value[0]);
    page.beginEditing();
    page.form.value.taskStatusId = 12;

    await page.saveRule();

    expect(mocks.taskRecurrenceApi.update).toHaveBeenCalledWith(
      5,
      71,
      expect.objectContaining({ status: "ACTIVE", taskStatusId: 12, version: 3 })
    );
    expect(page.isEditing.value).toBe(false);
  });

  it("保存中の再実行では更新APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.taskRecurrenceApi.update.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const page = createPage();
    await page.loadRules();
    await page.selectRule(page.rules.value[0]);
    page.beginEditing();

    const firstSave = page.saveRule();
    const secondSave = page.saveRule();

    expect(mocks.taskRecurrenceApi.update).toHaveBeenCalledOnce();
    resolveRequest({ ...rule, version: 4 });
    await Promise.all([firstSave, secondSave]);
  });

  it("archive成功後に規則と履歴を再取得して最新versionへ同期する", async () => {
    const archived = { ...rule, status: "ARCHIVED", nextOccurrenceDate: null, version: 4 };
    mocks.taskRecurrenceApi.findRules
      .mockResolvedValueOnce([structuredClone(rule)])
      .mockResolvedValueOnce([archived]);
    const page = createPage();
    await page.loadRules();
    await page.selectRule(page.rules.value[0]);

    await page.archiveRule();

    expect(mocks.taskRecurrenceApi.archive).toHaveBeenCalledWith(5, 71, 3);
    expect(page.selectedRule.value).toEqual(archived);
    expect(page.successMessage.value).toBe("繰り返しTask規則をアーカイブしました。");
  });

  it("FAILED履歴の再試行へ最新規則versionを送り、規則と履歴を再取得する", async () => {
    const recovered = { ...rule, version: 4 };
    mocks.taskRecurrenceApi.findRules
      .mockResolvedValueOnce([structuredClone(rule)])
      .mockResolvedValueOnce([recovered]);
    mocks.taskRecurrenceApi.findGenerations
      .mockResolvedValueOnce([structuredClone(failedGeneration)])
      .mockResolvedValueOnce([{ ...failedGeneration, status: "PENDING", attemptCount: 0 }]);
    const page = createPage();
    await page.loadRules();
    await page.selectRule(page.rules.value[0]);

    await page.retryGeneration(page.generations.value[0]);

    expect(mocks.taskRecurrenceApi.retryGeneration).toHaveBeenCalledWith(
      5,
      71,
      91,
      3
    );
    expect(page.selectedRule.value.version).toBe(4);
    expect(page.generations.value[0].status).toBe("PENDING");
  });

  it("更新の409競合ではdraftを破棄して最新規則と履歴を再取得する", async () => {
    const latest = { ...rule, title: "別画面の更新", version: 4 };
    mocks.taskRecurrenceApi.findRules
      .mockResolvedValueOnce([structuredClone(rule)])
      .mockResolvedValueOnce([latest]);
    mocks.taskRecurrenceApi.update.mockRejectedValue(
      new TaskRecurrenceApiError(409, {
        fieldErrors: [
          {
            field: "version",
            errorCode: "RECURRENCE_VERSION_CONFLICT",
            message: "別の操作で更新されました。",
          },
        ],
      })
    );
    const page = createPage();
    await page.loadRules();
    await page.selectRule(page.rules.value[0]);
    page.beginEditing();

    await page.saveRule();

    expect(page.selectedRule.value).toEqual(latest);
    expect(page.form.value.title).toBe("別画面の更新");
    expect(page.isEditing.value).toBe(false);
    expect(page.errorMessage.value).toBe("別の操作で更新されました。");
  });

  it("未知error codeではBackend文言を表示せず更新固定文言へfallbackする", async () => {
    mocks.taskRecurrenceApi.update.mockRejectedValue(
      new TaskRecurrenceApiError(400, {
        fieldErrors: [
          {
            field: "schedule",
            errorCode: "UNKNOWN_RECURRENCE_ERROR",
            message: "内部構造を含む未契約メッセージ",
          },
        ],
      })
    );
    const page = createPage();
    await page.loadRules();
    await page.selectRule(page.rules.value[0]);
    page.beginEditing();

    await page.saveRule();

    expect(page.errorMessage.value).toBe(
      "繰り返しTask規則を更新できませんでした。"
    );
    expect(page.isEditing.value).toBe(true);
  });

  it("更新の404ではBackend文言を表示せず固定文言で最新状態へ回復する", async () => {
    const latest = { ...rule, title: "最新規則", version: 4 };
    mocks.taskRecurrenceApi.findRules
      .mockResolvedValueOnce([structuredClone(rule)])
      .mockResolvedValueOnce([latest]);
    mocks.taskRecurrenceApi.update.mockRejectedValue(
      new TaskRecurrenceApiError(404, {
        fieldErrors: [
          {
            field: "taskRecurrenceRuleId",
            errorCode: "TASK_RECURRENCE_NOT_FOUND",
            message: "内部IDを含む表示禁止文言",
          },
        ],
      })
    );
    const page = createPage();
    await page.loadRules();
    await page.selectRule(page.rules.value[0]);
    page.beginEditing();

    await page.saveRule();

    expect(page.errorMessage.value).toBe(
      "対象のProject、繰り返しTask規則、生成履歴またはTask Templateが見つかりません。"
    );
    expect(page.selectedRule.value).toEqual(latest);
    expect(page.isEditing.value).toBe(false);
  });

  it("409回復中の401では古い規則を破棄してLoginへ戻す", async () => {
    mocks.taskRecurrenceApi.findRules
      .mockResolvedValueOnce([structuredClone(rule)])
      .mockRejectedValueOnce(new TaskRecurrenceApiError(401, null));
    mocks.taskRecurrenceApi.update.mockRejectedValue(
      new TaskRecurrenceApiError(409, {
        fieldErrors: [
          {
            field: "version",
            errorCode: "RECURRENCE_VERSION_CONFLICT",
            message: "別の操作で更新されました。",
          },
        ],
      })
    );
    const page = createPage();
    await page.loadRules();
    await page.selectRule(page.rules.value[0]);
    page.beginEditing();

    await page.saveRule();

    expect(page.rules.value).toEqual([]);
    expect(page.selectedRule.value).toBeNull();
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("409回復中の403では再取得側の固定文言を優先して古い規則を破棄する", async () => {
    mocks.taskRecurrenceApi.findRules
      .mockResolvedValueOnce([structuredClone(rule)])
      .mockRejectedValueOnce(new TaskRecurrenceApiError(403, null));
    mocks.taskRecurrenceApi.update.mockRejectedValue(
      new TaskRecurrenceApiError(409, {
        fieldErrors: [
          {
            field: "version",
            errorCode: "RECURRENCE_VERSION_CONFLICT",
            message: "別の操作で更新されました。",
          },
        ],
      })
    );
    const page = createPage();
    await page.loadRules();
    await page.selectRule(page.rules.value[0]);
    page.beginEditing();

    await page.saveRule();

    expect(page.errorMessage.value).toBe(
      "繰り返しTask規則を参照するpermissionがありません。"
    );
    expect(page.rules.value).toEqual([]);
    expect(page.selectedRule.value).toBeNull();
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("409回復中の通信失敗では競合理由と再取得失敗を併記する", async () => {
    mocks.taskRecurrenceApi.findRules
      .mockResolvedValueOnce([structuredClone(rule)])
      .mockRejectedValueOnce(new TypeError("Network error"));
    mocks.taskRecurrenceApi.update.mockRejectedValue(
      new TaskRecurrenceApiError(409, {
        fieldErrors: [
          {
            field: "version",
            errorCode: "RECURRENCE_VERSION_CONFLICT",
            message: "別の操作で更新されました。",
          },
        ],
      })
    );
    const page = createPage();
    await page.loadRules();
    await page.selectRule(page.rules.value[0]);
    page.beginEditing();

    await page.saveRule();

    expect(page.errorMessage.value).toBe(
      "別の操作で更新されました。\n最新の繰り返しTask規則と生成履歴を取得できませんでした。再読込してください。"
    );
    expect(page.rules.value).toEqual([]);
    expect(page.selectedRule.value).toBeNull();
  });

  it("archive確定後の再取得失敗をarchive失敗と誤表示せず古いversionを破棄する", async () => {
    const page = createPage();
    await page.loadRules();
    await page.selectRule(page.rules.value[0]);
    mocks.taskRecurrenceApi.findRules.mockRejectedValueOnce(
      new TypeError("Network error")
    );

    await page.archiveRule();

    expect(mocks.taskRecurrenceApi.archive).toHaveBeenCalledWith(5, 71, 3);
    expect(page.errorMessage.value).toBe(
      "操作は完了しましたが、最新の繰り返しTask規則と生成履歴を取得できませんでした。再読込してください。"
    );
    expect(page.successMessage.value).toBe("");
    expect(page.rules.value).toEqual([]);
    expect(page.selectedRule.value).toBeNull();
    expect(page.isArchiving.value).toBe(false);
  });

  it("retry確定後の再取得401では古い状態とSessionを破棄してLoginへ戻す", async () => {
    const page = createPage();
    await page.loadRules();
    await page.selectRule(page.rules.value[0]);
    mocks.taskRecurrenceApi.findRules.mockRejectedValueOnce(
      new TaskRecurrenceApiError(401, null)
    );

    await page.retryGeneration(page.generations.value[0]);

    expect(mocks.taskRecurrenceApi.retryGeneration).toHaveBeenCalledOnce();
    expect(page.rules.value).toEqual([]);
    expect(page.generations.value).toEqual([]);
    expect(page.retryingGenerationId.value).toBeNull();
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("一覧の403では取得済み規則を破棄して参照用固定文言を表示する", async () => {
    const page = createPage();
    await page.loadRules();
    mocks.taskRecurrenceApi.findRules.mockRejectedValue(
      new TaskRecurrenceApiError(403, null)
    );

    await page.loadRules();

    expect(page.rules.value).toEqual([]);
    expect(page.errorMessage.value).toBe(
      "繰り返しTask規則を参照するpermissionがありません。"
    );
  });

  it("一覧取得の401ではSession表示を破棄してLoginへ戻す", async () => {
    mocks.taskRecurrenceApi.findRules.mockRejectedValue(
      new TaskRecurrenceApiError(401, null)
    );
    const page = createPage();

    await page.loadRules();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });
});
