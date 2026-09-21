import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectTemplateApiError } from "@/features/project/api/projectTemplateApi";
import { useProjectTemplateCapture } from "@/features/project/composables/useProjectTemplateCapture";

const mocks = vi.hoisted(() => ({
  projectTemplateApi: { capture: vi.fn() },
  router: { push: vi.fn() },
  userStore: { clearSession: vi.fn() },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/project/api/projectTemplateApi", async () => {
  const actual = await vi.importActual(
    "@/features/project/api/projectTemplateApi"
  );
  return { ...actual, default: mocks.projectTemplateApi };
});

describe("useProjectTemplateCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.projectTemplateApi.capture.mockResolvedValue({
      projectTemplateId: 81,
    });
  });

  it("名称をtrimしてProject構造を基準日付きでcaptureする", async () => {
    const state = useProjectTemplateCapture(ref(5), ref(false));
    state.open();
    state.name.value = "  開発Template  ";
    state.baseDate.value = "2026-09-21";

    await state.capture();

    expect(mocks.projectTemplateApi.capture).toHaveBeenCalledWith(5, {
      name: "開発Template",
      baseDate: "2026-09-21",
    });
    expect(state.isOpen.value).toBe(false);
    expect(state.successMessage.value).toBe(
      "ProjectをTemplateとして保存しました。"
    );
  });

  it("参照専用状態ではDialogを開かずcapture APIも呼ばない", async () => {
    const state = useProjectTemplateCapture(ref(5), ref(true));

    state.open();
    state.name.value = "開発Template";
    await state.capture();

    expect(state.isOpen.value).toBe(false);
    expect(mocks.projectTemplateApi.capture).not.toHaveBeenCalled();
  });

  it("存在しない基準日はcapture API送信前に拒否する", async () => {
    const state = useProjectTemplateCapture(ref(5), ref(false));
    state.open();
    state.name.value = "開発Template";
    state.baseDate.value = "2026-02-30";

    await state.capture();

    expect(mocks.projectTemplateApi.capture).not.toHaveBeenCalled();
    expect(state.errorMessage.value).toContain("基準日");
  });

  it("機能資格403ではBackendのupgrade案内をDialogへ表示する", async () => {
    mocks.projectTemplateApi.capture.mockRejectedValue(
      new ProjectTemplateApiError(403, {
        fieldErrors: [
          {
            field: "featureCode",
            errorCode: "FEATURE_NOT_ENTITLED",
            message: "現在のPlanでは利用できません。",
          },
        ],
      })
    );
    const state = useProjectTemplateCapture(ref(5), ref(false));
    state.open();
    state.name.value = "開発Template";
    state.baseDate.value = "2026-09-21";

    await state.capture();

    expect(state.errorMessage.value).toBe("現在のPlanでは利用できません。");
    expect(state.isOpen.value).toBe(true);
  });

  it("401ではSession表示を破棄してLoginへ戻す", async () => {
    mocks.projectTemplateApi.capture.mockRejectedValue(
      new ProjectTemplateApiError(401, null)
    );
    const state = useProjectTemplateCapture(ref(5), ref(false));
    state.open();
    state.name.value = "開発Template";

    await state.capture();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });
});
