import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectApiError } from "@/features/project/api/projectApi";
import { useProjectListPage } from "@/features/project/composables/useProjectListPage";

const mocks = vi.hoisted(() => ({
  projectApi: { getProjects: vi.fn() },
  router: { push: vi.fn() },
  userStore: { clearSession: vi.fn() },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/project/api/projectApi", async () => {
  const actual = await vi.importActual("@/features/project/api/projectApi");
  return { ...actual, default: mocks.projectApi };
});

const projects = [
  {
    projectId: 1,
    projectKey: "DEMO",
    name: "開発Project",
    status: "ACTIVE",
    projectRole: "OWNER",
    version: 1,
  },
  {
    projectId: 2,
    projectKey: "OPS",
    name: "運用Project",
    status: "ACTIVE",
    projectRole: "MEMBER",
    version: 1,
  },
];

describe("useProjectListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.projectApi.getProjects.mockResolvedValue(projects);
  });

  it("初期表示で参照可能なProjectを取得する", async () => {
    const page = useProjectListPage();

    await page.initialize();

    expect(mocks.projectApi.getProjects).toHaveBeenCalledOnce();
    expect(page.projects.value).toEqual(projects);
  });

  it("Projectキー・名称・Projectロールで大文字小文字を区別せず検索する", async () => {
    const page = useProjectListPage();
    await page.initialize();

    page.searchText.value = "member";

    expect(page.filteredProjects.value).toEqual([projects[1]]);
  });

  it("選択ProjectのBoardへProject ID付きで遷移する", async () => {
    const page = useProjectListPage();

    await page.openBoard(2);

    expect(mocks.router.push).toHaveBeenCalledWith({
      name: "TaskBoard",
      params: { projectId: 2 },
    });
  });

  it("読込中の再実行ではProject APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.projectApi.getProjects.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const page = useProjectListPage();

    const firstLoad = page.initialize();
    const secondLoad = page.initialize();

    expect(mocks.projectApi.getProjects).toHaveBeenCalledOnce();
    resolveRequest(projects);
    await Promise.all([firstLoad, secondLoad]);
  });

  it("401はSessionを破棄してログインへ戻す", async () => {
    mocks.projectApi.getProjects.mockRejectedValue(new ProjectApiError(401, null));
    const page = useProjectListPage();

    await page.initialize();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });
});
