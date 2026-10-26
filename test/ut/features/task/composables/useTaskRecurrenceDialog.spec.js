import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import { useTaskRecurrenceDialog } from "@/features/task/composables/useTaskRecurrenceDialog";

const mocks = vi.hoisted(() => ({
  recurrences: null,
}));

vi.mock("@/features/task/composables/useTaskRecurrences", () => ({
  useTaskRecurrences: () => mocks.recurrences,
}));

const members = [
  { accountId: 7, projectRole: "OWNER", displayName: "山田 太郎", accountStatus: "ACTIVE" },
  { accountId: 8, projectRole: "MEMBER", displayName: "佐藤 花子", accountStatus: "ACTIVE" },
];
const statuses = [
  { taskStatusId: 1, statusCode: "DONE", name: "完了", completed: true },
  { taskStatusId: 2, statusCode: "TODO", name: "Todo", completed: false },
];

const createDialog = (overrides = {}) =>
  useTaskRecurrenceDialog({
    projectId: ref(5),
    members,
    statuses,
    canUpdate: true,
    projectActive: true,
    ...overrides,
  });

describe("useTaskRecurrenceDialog", () => {
  beforeEach(() => {
    mocks.recurrences = {
      archiveRule: vi.fn().mockResolvedValue(undefined),
      beginCreating: vi.fn(),
      creationMode: ref("DIRECT"),
      form: ref({ assigneeAccountId: 7, taskStatusId: 2 }),
      loadRules: vi.fn().mockResolvedValue(undefined),
      loadTemplates: vi.fn().mockResolvedValue(undefined),
      selectedRule: ref(null),
      templates: ref([]),
    };
  });

  it("Dialogを開くと規則一覧を取得する", async () => {
    const dialog = createDialog();

    await dialog.open();

    expect(dialog.isOpen.value).toBe(true);
    expect(mocks.recurrences.loadRules).toHaveBeenCalledTimes(1);
  });

  it("作成開始時は先頭memberと先頭の未完了列を既定値にする", () => {
    createDialog().startCreating();

    expect(mocks.recurrences.beginCreating).toHaveBeenCalledWith(7, 2);
  });

  it("Template作成へ切り替えると上書き値を外し、未取得のTemplate一覧を取得する", async () => {
    const dialog = createDialog();

    await dialog.changeCreationMode("TEMPLATE");

    expect(mocks.recurrences.creationMode.value).toBe("TEMPLATE");
    expect(mocks.recurrences.form.value).toEqual({ assigneeAccountId: null, taskStatusId: null });
    expect(mocks.recurrences.loadTemplates).toHaveBeenCalledTimes(1);
  });

  it("直接作成へ戻すと未入力の担当者と列だけ既定値で補う", async () => {
    mocks.recurrences.form.value = { assigneeAccountId: 8, taskStatusId: null };
    const dialog = createDialog();

    await dialog.changeCreationMode("DIRECT");

    expect(mocks.recurrences.form.value).toEqual({ assigneeAccountId: 8, taskStatusId: 2 });
  });

  it.each([
    ["ACTIVE", true, true],
    ["BLOCKED", true, true],
    ["ENDED", false, true],
    ["ARCHIVED", false, false],
  ])("状態%sの規則は編集可否%s・archive可否%s", (status, canEdit, canArchive) => {
    mocks.recurrences.selectedRule.value = { status };
    const dialog = createDialog();

    expect(dialog.canEditSelected.value).toBe(canEdit);
    expect(dialog.canArchiveSelected.value).toBe(canArchive);
  });

  it("archive済みProjectでは規則を編集・archiveできない", () => {
    mocks.recurrences.selectedRule.value = { status: "ACTIVE" };
    const dialog = createDialog({ projectActive: false });

    expect(dialog.canEditSelected.value).toBe(false);
    expect(dialog.canArchiveSelected.value).toBe(false);
  });

  it("archive確認後は確認Dialogを閉じる", async () => {
    const dialog = createDialog();
    dialog.isArchiveConfirmOpen.value = true;

    await dialog.confirmArchive();

    expect(mocks.recurrences.archiveRule).toHaveBeenCalledTimes(1);
    expect(dialog.isArchiveConfirmOpen.value).toBe(false);
  });

  it("発生曜日の選択を追加・解除で切り替える", () => {
    mocks.recurrences.form.value = { weekdays: ["MONDAY"] };
    const dialog = createDialog();

    dialog.toggleWeekday("FRIDAY");
    expect(mocks.recurrences.form.value.weekdays).toEqual(["MONDAY", "FRIDAY"]);
    dialog.toggleWeekday("MONDAY");
    expect(mocks.recurrences.form.value.weekdays).toEqual(["FRIDAY"]);
  });
});
