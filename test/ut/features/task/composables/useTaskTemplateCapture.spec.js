import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskTemplateApiError } from "@/features/task/api/taskTemplateApi";
import { useTaskTemplateCapture } from "@/features/task/composables/useTaskTemplateCapture";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  taskTemplateApi: { capture: vi.fn() },
  userStore: { clearSession: vi.fn() },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/task/api/taskTemplateApi", async () => {
  const actual = await vi.importActual("@/features/task/api/taskTemplateApi");
  return { ...actual, default: mocks.taskTemplateApi };
});

describe("useTaskTemplateCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.taskTemplateApi.capture.mockResolvedValue({ taskTemplateId: 81 });
  });

  it("名称をtrimして表示中TaskをTemplateへcaptureする", async () => {
    const state = useTaskTemplateCapture(ref(5), ref(31), ref(false));
    state.open();
    state.name.value = "  API実装  ";

    await state.capture();

    expect(mocks.taskTemplateApi.capture).toHaveBeenCalledWith(5, 31, {
      name: "API実装",
    });
    expect(state.isOpen.value).toBe(false);
    expect(state.successMessage.value).toBe(
      "TaskをTemplateとして保存しました。"
    );
  });

  it("参照専用ではDialogを開かずcapture APIも呼ばない", async () => {
    const state = useTaskTemplateCapture(ref(5), ref(31), ref(true));

    state.open();
    state.name.value = "API実装";
    await state.capture();

    expect(state.isOpen.value).toBe(false);
    expect(mocks.taskTemplateApi.capture).not.toHaveBeenCalled();
  });

  it("機能資格403ではBackendメッセージを表示する", async () => {
    mocks.taskTemplateApi.capture.mockRejectedValue(
      new TaskTemplateApiError(403, {
        fieldErrors: [
          {
            field: "featureCode",
            errorCode: "FEATURE_NOT_ENTITLED",
            message: "現在のPlanでは利用できません。",
          },
        ],
      })
    );
    const state = useTaskTemplateCapture(ref(5), ref(31), ref(false));
    state.open();
    state.name.value = "API実装";

    await state.capture();

    expect(state.errorMessage.value).toBe("現在のPlanでは利用できません。");
    expect(state.isOpen.value).toBe(true);
  });

  it("本文なしのpermission 403では固定文言を表示してSessionを維持する", async () => {
    mocks.taskTemplateApi.capture.mockRejectedValue(
      new TaskTemplateApiError(403, null)
    );
    const state = useTaskTemplateCapture(ref(5), ref(31), ref(false));
    state.open();
    state.name.value = "API実装";

    await state.capture();

    expect(state.errorMessage.value).toBe(
      "このTask Template操作を実行するpermissionがありません。"
    );
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
    expect(state.isOpen.value).toBe(true);
  });

  it("未知error codeのBackend文言を表示せずcapture固定文言へfallbackする", async () => {
    mocks.taskTemplateApi.capture.mockRejectedValue(
      new TaskTemplateApiError(400, {
        fieldErrors: [
          {
            field: "name",
            errorCode: "UNKNOWN_TEMPLATE_ERROR",
            message: "内部構造を含む未契約メッセージ",
          },
        ],
      })
    );
    const state = useTaskTemplateCapture(ref(5), ref(31), ref(false));
    state.open();
    state.name.value = "API実装";

    await state.capture();

    expect(state.errorMessage.value).toBe(
      "TaskをTemplateとして保存できませんでした。"
    );
  });

  it("401では入力とDialogを破棄してLoginへ戻す", async () => {
    mocks.taskTemplateApi.capture.mockRejectedValue(
      new TaskTemplateApiError(401, null)
    );
    const state = useTaskTemplateCapture(ref(5), ref(31), ref(false));
    state.open();
    state.name.value = "API実装";

    await state.capture();

    expect(state.name.value).toBe("");
    expect(state.isOpen.value).toBe(false);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it.each([
    ["", false, false],
    ["   ", false, false],
    ["a".repeat(100), false, true],
    ["a".repeat(101), false, false],
    ["Template", true, false],
  ])("名称%j・参照専用%sの保存可否は%s", (name, disabled, expected) => {
    const state = useTaskTemplateCapture(ref(5), ref(31), ref(disabled));
    state.name.value = name;

    expect(state.canCapture.value).toBe(expected);
  });
});
