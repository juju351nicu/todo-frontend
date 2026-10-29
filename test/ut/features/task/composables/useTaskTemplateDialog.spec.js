import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";

import { useTaskTemplateDialog } from "@/features/task/composables/useTaskTemplateDialog";

const mocks = vi.hoisted(() => ({
  templates: null,
}));

vi.mock("@/features/task/composables/useTaskTemplates", () => ({
  useTaskTemplates: () => mocks.templates,
}));

const members = [
  { accountId: 7, projectRole: "OWNER", displayName: "山田 太郎", accountStatus: "ACTIVE" },
  { accountId: 8, projectRole: "MEMBER", displayName: "佐藤 花子", accountStatus: "ACTIVE" },
];
const statuses = [
  { taskStatusId: 2, statusCode: "TODO", name: "未着手", completed: false },
  { taskStatusId: 3, statusCode: "DONE", name: "完了", completed: true },
];

const createDialog = (onTaskCreated = vi.fn(), restrictedAssigneeAccountId = null) =>
  useTaskTemplateDialog({
    projectId: ref(5),
    members,
    statuses,
    restrictedAssigneeAccountId: () => restrictedAssigneeAccountId,
    onTaskCreated,
  });

describe("useTaskTemplateDialog", () => {
  beforeEach(() => {
    mocks.templates = {
      applyAssigneeAccountId: ref(null),
      selectedTemplate: ref(null),
      applyTemplate: vi.fn(),
      archiveTemplate: vi.fn().mockResolvedValue(undefined),
      loadTemplates: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("Dialogを開くとTemplate一覧を取得する", async () => {
    const dialog = createDialog();

    await dialog.open();

    expect(dialog.isOpen.value).toBe(true);
    expect(mocks.templates.loadTemplates).toHaveBeenCalledTimes(1);
  });

  it("Template適用に成功したらDialogを閉じて作成Taskを通知する", async () => {
    const created = { taskId: 99 };
    mocks.templates.applyTemplate.mockResolvedValue(created);
    const onTaskCreated = vi.fn();
    const dialog = createDialog(onTaskCreated);
    dialog.isOpen.value = true;

    await dialog.applySelectedTemplate();

    expect(dialog.isOpen.value).toBe(false);
    expect(onTaskCreated).toHaveBeenCalledWith(created);
  });

  it("Template適用に失敗したらDialogを開いたまま通知しない", async () => {
    mocks.templates.applyTemplate.mockResolvedValue(null);
    const onTaskCreated = vi.fn();
    const dialog = createDialog(onTaskCreated);
    dialog.isOpen.value = true;

    await dialog.applySelectedTemplate();

    expect(dialog.isOpen.value).toBe(true);
    expect(onTaskCreated).not.toHaveBeenCalled();
  });

  it("archive確認後は確認Dialogを閉じる", async () => {
    const dialog = createDialog();
    dialog.isArchiveConfirmOpen.value = true;

    await dialog.confirmArchive();

    expect(mocks.templates.archiveTemplate).toHaveBeenCalledTimes(1);
    expect(dialog.isArchiveConfirmOpen.value).toBe(false);
  });

  it("担当者・列IDと列codeの選択肢を作る。適用先の列は完了列を除く", () => {
    const dialog = createDialog();

    expect(dialog.memberOptions.value).toEqual([
      { title: "山田 太郎（OWNER）", value: 7 },
      { title: "佐藤 花子（MEMBER）", value: 8 },
    ]);
    expect(dialog.applyAssigneeOptions.value).toEqual(dialog.memberOptions.value);
    // Backendは完了列への適用を409で拒否するため、適用の列候補に「完了」を出さない。
    expect(dialog.applyStatusOptions.value).toEqual([{ title: "未着手", value: 2 }]);
    // Template編集の既定列は、保存済みの値を表示できるよう全列を候補にする。
    expect(dialog.statusCodeOptions.value).toEqual([
      { title: "未着手（TODO）", value: "TODO" },
      { title: "完了（DONE）", value: "DONE" },
    ]);
  });

  it("担当者を限定する（MEMBER）場合、適用の担当者候補は本人だけで、Templateを選ぶと本人を入れる", async () => {
    const dialog = createDialog(vi.fn(), 8);

    expect(dialog.applyAssigneeOptions.value).toEqual([{ title: "佐藤 花子（MEMBER）", value: 8 }]);
    // Template編集の既定担当者は、他の参加者も選べる。
    expect(dialog.memberOptions.value).toHaveLength(2);

    mocks.templates.selectedTemplate.value = { taskTemplateId: 1, defaultAssigneeAccountId: 7 };
    await nextTick();
    expect(mocks.templates.applyAssigneeAccountId.value).toBe(8);

    // 別のTemplateを選び直して担当者がnullへ戻っても、本人を入れ直す。
    mocks.templates.applyAssigneeAccountId.value = null;
    mocks.templates.selectedTemplate.value = { taskTemplateId: 2, defaultAssigneeAccountId: 7 };
    await nextTick();
    expect(mocks.templates.applyAssigneeAccountId.value).toBe(8);
  });

  it("担当者を限定しない場合は、Templateを選んでも担当者を入れない（Template既定値を使う）", async () => {
    const dialog = createDialog();

    mocks.templates.selectedTemplate.value = { taskTemplateId: 1, defaultAssigneeAccountId: 7 };
    await nextTick();

    expect(dialog.applyAssigneeOptions.value).toHaveLength(2);
    expect(mocks.templates.applyAssigneeAccountId.value).toBeNull();
  });
});
