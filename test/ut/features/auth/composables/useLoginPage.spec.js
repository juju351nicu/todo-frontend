import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthApi from "@/features/auth/api/authApi";
import { useLoginPage } from "@/features/auth/composables/useLoginPage";

const mocks = vi.hoisted(() => ({
  route: {
    path: "/",
    query: {},
  },
  router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
  userStore: {
    authLogin: vi.fn(),
    restoreSession: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({
  useRoute: () => mocks.route,
  useRouter: () => mocks.router,
}));

vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

vi.mock("@/features/auth/api/authApi", () => ({
  default: {
    getGitHubAuthorizationUrl: vi.fn(),
  },
}));

describe("useLoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.route.path = "/";
    mocks.route.query = {};
    mocks.router.push.mockResolvedValue(undefined);
    mocks.router.replace.mockResolvedValue(undefined);
    mocks.userStore.restoreSession.mockResolvedValue(false);
  });

  it("既存Sessionがあれば会員一覧へ移動する", async () => {
    mocks.userStore.restoreSession.mockResolvedValue(true);
    const page = useLoginPage();

    await page.initialize();

    expect(mocks.router.push).toHaveBeenCalledWith({ name: "MemberList" });
  });

  it("OAuth2エラーを画面メッセージへ変換してURLから除去する", async () => {
    mocks.route.query = { oauthError: "email_required" };
    const page = useLoginPage();

    await page.initialize();

    expect(page.isShowModal.value).toBe(true);
    expect(page.errorMessages.value).toEqual([
      "GitHubからメールアドレスを取得できませんでした。GitHubのメール設定を確認してください。",
    ]);
    expect(mocks.router.replace).toHaveBeenCalledWith({ path: "/", query: {} });
  });

  it("ログイン成功時はフォームをStoreへ渡して会員一覧へ移動する", async () => {
    mocks.userStore.authLogin.mockResolvedValue({ ok: true, status: 204 });
    const page = useLoginPage();
    page.loginForm.value = { loginId: "user01", password: "password" };

    await page.submitForm();

    expect(mocks.userStore.authLogin).toHaveBeenCalledWith({
      loginId: "user01",
      password: "password",
    });
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "MemberList" });
    expect(page.isLoading.value).toBe(false);
  });

  it("認証失敗時は利用者向けメッセージを表示する", async () => {
    mocks.userStore.authLogin.mockResolvedValue({ ok: false, status: 401 });
    const page = useLoginPage();

    await page.submitForm();

    expect(page.isShowModal.value).toBe(true);
    expect(page.errorMessages.value).toEqual([
      "ログインIDまたはパスワードが正しくありません。",
    ]);
  });

  it("GitHub OAuth2ログインをBackendの認可URLから開始する", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    AuthApi.getGitHubAuthorizationUrl.mockReturnValue(
      "http://localhost:8030/oauth2/authorization/github"
    );
    const page = useLoginPage();

    page.submitGithub();

    expect(assign).toHaveBeenCalledWith(
      "http://localhost:8030/oauth2/authorization/github"
    );
    vi.unstubAllGlobals();
  });
});
