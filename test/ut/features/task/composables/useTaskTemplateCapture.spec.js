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
});
