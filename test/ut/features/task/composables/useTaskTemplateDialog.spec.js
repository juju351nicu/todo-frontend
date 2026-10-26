import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import { useTaskTemplateDialog } from "@/features/task/composables/useTaskTemplateDialog";

const mocks = vi.hoisted(() => ({
  templates: null,
}));

vi.mock("@/features/task/composables/useTaskTemplates", () => ({
  useTaskTemplates: () => mocks.templates,
}));

const createDialog = (onTaskCreated = vi.fn()) =>
  useTaskTemplateDialog({
    projectId: ref(5),
    members: [{ accountId: 7, projectRole: "OWNER", displayName: "山田 太郎", accountStatus: "ACTIVE" }],
    statuses: [{ taskStatusId: 2, statusCode: "TODO", name: "Todo", completed: false }],
    onTaskCreated,
  });

describe("useTaskTemplateDialog", () => {
  beforeEach(() => {
    mocks.templates = {
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

  it("担当者・列IDと列codeの選択肢を作る", () => {
    const dialog = createDialog();

    expect(dialog.memberOptions.value).toEqual([{ title: "山田 太郎（OWNER）", value: 7 }]);
    expect(dialog.statusIdOptions.value).toEqual([{ title: "Todo", value: 2 }]);
    expect(dialog.statusCodeOptions.value).toEqual([{ title: "Todo（TODO）", value: "TODO" }]);
  });
});
