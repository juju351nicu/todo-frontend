// @vitest-environment happy-dom
import { flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUserStore } from "@/features/auth/stores/user";
import TaskCommentsPanel from "@/features/task/components/TaskCommentsPanel.vue";
import {
  buildCommentEditControlKey,
  COMMENT_COMPOSER_CONTROL,
} from "@/features/task/composables/useTaskComments";
import { mountWithUi } from "../../../support/mountWithUi";

const mocks = vi.hoisted(() => ({
  findComments: vi.fn(),
}));

vi.mock("@/features/task/api/taskCommentApi", async (importOriginal) => ({
  ...(await importOriginal()),
  default: { findComments: mocks.findComments },
}));

const comment = (commentId, authorAccountId) => ({
  commentId,
  taskId: 10,
  authorAccountId,
  authorDisplayName: `投稿者${authorAccountId}`,
  authorAccountStatus: "ACTIVE",
  body: `コメント${commentId}`,
  createdAt: "2026-10-29T00:00:00Z",
  updatedAt: "2026-10-29T00:00:00Z",
  version: 0,
});

describe("TaskCommentsPanel", () => {
  let wrapper;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  const mountPanel = async (disabled) => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useUserStore().setSessionUser({
      accountId: 7,
      username: "user07",
      displayName: "本人",
      roleCodes: [],
      permissionCodes: ["TASK_READ"],
    });
    mocks.findComments.mockResolvedValue([comment(1, 7), comment(2, 8)]);
    wrapper = mountWithUi(TaskCommentsPanel, { pinia, props: { projectId: 1, taskId: 10, disabled } });
    await flushPromises();
  };

  it("投稿できるときは、本人のコメントにだけ編集ボタンを出し、投稿欄を使える", async () => {
    await mountPanel(false);

    expect(wrapper.find(`[data-comment-control="${buildCommentEditControlKey(1)}"]`).exists()).toBe(true);
    expect(wrapper.find(`[data-comment-control="${buildCommentEditControlKey(2)}"]`).exists()).toBe(false);
    expect(wrapper.find(`[data-comment-control="${COMMENT_COMPOSER_CONTROL}"]`).attributes("disabled")).toBeUndefined();
  });

  it("投稿できないとき（disabled）は、本人のコメントにも編集ボタンを出さず、投稿欄を使えない", async () => {
    await mountPanel(true);

    expect(wrapper.find(`[data-comment-control="${buildCommentEditControlKey(1)}"]`).exists()).toBe(false);
    expect(wrapper.find(`[data-comment-control="${COMMENT_COMPOSER_CONTROL}"]`).attributes("disabled")).toBeDefined();
  });
});
