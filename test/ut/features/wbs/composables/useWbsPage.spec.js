import { beforeEach, describe, expect, it, vi } from "vitest";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";

const mocks = vi.hoisted(() => ({
  route: { params: { projectId: "7" } },
  router: { push: vi.fn() },
  userStore: { clearSession: vi.fn() },
  wbsApi: { getWbs: vi.fn() },
}));

vi.mock("vue-router", () => ({
  useRoute: () => mocks.route,
  useRouter: () => mocks.router,
}));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/wbs/api/wbsApi", async () => {
  const actual = await vi.importActual("@/features/wbs/api/wbsApi");
  return { ...actual, default: mocks.wbsApi };
});

const wbs = {
  projectId: 7,
  projectName: "開発Project",
  tasks: [
    {
      taskId: 2,
      parentTaskId: 1,
      taskType: "TASK",
      title: "実装",
      position: 1000,
    },
    {
      taskId: 1,
      parentTaskId: null,
      taskType: "SUMMARY",
      title: "Phase 1",
      position: 1000,
    },
    {
      taskId: 3,
      parentTaskId: 1,
      taskType: "MILESTONE",
      title: "完了判定",
      position: 2000,
    },
  ],
};

describe("useWbsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.route.params.projectId = "7";
    mocks.router.push.mockResolvedValue(undefined);
    mocks.wbsApi.getWbs.mockResolvedValue(wbs);
  });

  it("初期表示でProject WBSを取得して階層行と種別件数を作る", async () => {
    const page = useWbsPage();

    await page.initialize();

    expect(mocks.wbsApi.getWbs).toHaveBeenCalledWith(7);
    expect(page.rows.value.map((row) => [row.taskId, row.depth])).toEqual([
      [1, 0],
      [2, 1],
      [3, 1],
    ]);
    expect(page.taskCount.value).toBe(1);
    expect(page.summaryCount.value).toBe(1);
    expect(page.milestoneCount.value).toBe(1);
  });

  it("不正なProject IDではAPIを呼ばず画面へ理由を表示する", async () => {
    mocks.route.params.projectId = "invalid";
    const page = useWbsPage();

    await page.initialize();

    expect(mocks.wbsApi.getWbs).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual(["Project IDが不正です。"]);
  });

  it("読込中の再実行ではWBS APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.wbsApi.getWbs.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const page = useWbsPage();

    const firstLoad = page.initialize();
    const secondLoad = page.initialize();

    expect(mocks.wbsApi.getWbs).toHaveBeenCalledOnce();
    resolveRequest(wbs);
    await Promise.all([firstLoad, secondLoad]);
  });

  it("401はSessionを破棄してログインへ戻す", async () => {
    mocks.wbsApi.getWbs.mockRejectedValue(new WbsApiError(401, null));
    const page = useWbsPage();

    await page.initialize();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("403と404をpermission不足・未参加Projectとして区別する", async () => {
    mocks.wbsApi.getWbs.mockRejectedValueOnce(new WbsApiError(403, null));
    const forbiddenPage = useWbsPage();
    await forbiddenPage.initialize();

    mocks.wbsApi.getWbs.mockRejectedValueOnce(new WbsApiError(404, null));
    const missingPage = useWbsPage();
    await missingPage.initialize();

    expect(forbiddenPage.errorMessages.value).toEqual([
      "WBSを参照するpermissionがありません。",
    ]);
    expect(missingPage.errorMessages.value).toEqual([
      "Projectが見つからないか、このProjectへ参加していません。",
    ]);
  });

  it("現在のProject IDを保持してBoardへ戻る", async () => {
    const page = useWbsPage();

    await page.openBoard();

    expect(mocks.router.push).toHaveBeenCalledWith({
      name: "TaskBoard",
      params: { projectId: 7 },
    });
  });
});
