// @vitest-environment happy-dom
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskChecklistPanel from "@/features/task/components/TaskChecklistPanel.vue";
import { CHECKLIST_ITEM_MAX_COUNT } from "@/features/task/constants/taskLimits";
import { mountWithUi } from "../../../support/mountWithUi";

const mocks = vi.hoisted(() => ({
  findItems: vi.fn(),
}));

vi.mock("@/features/task/api/taskChecklistApi", async (importOriginal) => ({
  ...(await importOriginal()),
  default: { findItems: mocks.findItems },
}));

const item = (checklistItemId, overrides = {}) => ({
  checklistItemId,
  taskId: 10,
  content: `項目${checklistItemId}`,
  completed: false,
  position: checklistItemId * 1000,
  createdBy: 1,
  createdAt: "2026-10-29T00:00:00Z",
  updatedBy: 1,
  updatedAt: "2026-10-29T00:00:00Z",
  version: 0,
  ...overrides,
});

describe("TaskChecklistPanel", () => {
  let wrapper;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  const mountPanel = async (items, disabled = false) => {
    mocks.findItems.mockResolvedValue(items);
    wrapper = mountWithUi(TaskChecklistPanel, { props: { projectId: 1, taskId: 10, disabled } });
    await flushPromises();
  };

  it("編集できるときは、各行の操作と追加欄を出し、data-checklist-controlで戻し先を特定できる", async () => {
    await mountPanel([item(1), item(2)]);

    expect(wrapper.find('[data-checklist-control="1:toggle"]').exists()).toBe(true);
    expect(wrapper.find('[data-checklist-control="1:edit"]').exists()).toBe(true);
    // 先頭の「上へ」と末尾の「下へ」は押せない。
    expect(
      wrapper.find('[data-checklist-control="1:move-up"]').attributes("disabled")
    ).toBeDefined();
    expect(
      wrapper.find('[data-checklist-control="2:move-down"]').attributes("disabled")
    ).toBeDefined();
    expect(
      wrapper.find('[data-checklist-control="1:move-down"]').attributes("disabled")
    ).toBeUndefined();
    expect(wrapper.findAll("button").some((button) => button.text() === "追加")).toBe(true);
  });

  it("参照のみ（disabled）のときは、行の操作と追加欄を出さず、完了のチェックはdisabledで状態だけを示す", async () => {
    await mountPanel([item(1, { completed: true })], true);

    expect(wrapper.find('[data-checklist-control="1:edit"]').exists()).toBe(false);
    expect(wrapper.find('[data-checklist-control="1:move-up"]').exists()).toBe(false);
    expect(wrapper.findAll("button").some((button) => button.text() === "追加")).toBe(false);
    expect(
      wrapper.find('[data-checklist-control="1:toggle"]').attributes("disabled")
    ).toBeDefined();
  });

  it("上限件数に達したら、追加できないことを案内する", async () => {
    await mountPanel(
      Array.from({ length: CHECKLIST_ITEM_MAX_COUNT }, (_, index) => item(index + 1))
    );

    expect(wrapper.text()).toContain(`チェック項目は最大${CHECKLIST_ITEM_MAX_COUNT}件です。`);
  });
});
