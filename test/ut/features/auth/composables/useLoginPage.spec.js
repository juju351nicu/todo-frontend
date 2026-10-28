import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthApi, { AuthApiError } from "@/features/auth/api/authApi";
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
    permissionCodes: ["TASK_READ_OWN"],
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

vi.mock("@/features/auth/api/authApi", async () => {
  const actual = await vi.importActual("@/features/auth/api/authApi");
  return {
    ...actual,
    default: {
      getGitHubAuthorizationUrl: vi.fn(),
    },
  };
});

describe("useLoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.route.path = "/";
    mocks.route.query = {};
    mocks.router.push.mockResolvedValue(undefined);
    mocks.router.replace.mockResolvedValue(undefined);
    mocks.userStore.restoreSession.mockResolvedValue(false);
    mocks.userStore.permissionCodes = ["TASK_READ_OWN"];
  });

  it("既存SessionがあればDashboardへ移動する", async () => {
    mocks.userStore.restoreSession.mockResolvedValue(true);
    const page = useLoginPage();

    await page.initialize();

    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Dashboard" });
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

  it("保護画面から戻されたときは要ログインの案内を画面内に出してURLから除去する", async () => {
    mocks.route.query = { reason: "login_required" };
    const page = useLoginPage();

    await page.initialize();

    expect(page.loginNotice.value).toBe(
      "この画面を開くにはログインが必要です。ログインしてください。"
    );
    expect(page.isShowModal.value).toBe(false);
    expect(mocks.router.replace).toHaveBeenCalledWith({ path: "/", query: {} });
  });

  it("queryがなければ案内を出さずURLも変えない", async () => {
    const page = useLoginPage();

    await page.initialize();

    expect(page.loginNotice.value).toBe("");
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("既存Sessionがあれば要ログインの案内を出さずに既定画面へ移動する", async () => {
    mocks.userStore.restoreSession.mockResolvedValue(true);
    mocks.route.query = { reason: "login_required" };
    const page = useLoginPage();

    await page.initialize();

    expect(page.loginNotice.value).toBe("");
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Dashboard" });
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("ログイン成功時はフォームをStoreへ渡してDashboardへ移動する", async () => {
    mocks.userStore.authLogin.mockResolvedValue(true);
    const page = useLoginPage();
    page.loginForm.value = { loginId: "user01", password: "password" };

    await page.submitForm();

    expect(mocks.userStore.authLogin).toHaveBeenCalledWith({
      loginId: "user01",
      password: "password",
    });
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Dashboard" });
    expect(page.isLoading.value).toBe(false);
  });

  it("認証失敗時は利用者向けメッセージを表示する", async () => {
    mocks.userStore.authLogin.mockRejectedValue(new AuthApiError(401, null));
    const page = useLoginPage();

    await page.submitForm();

    expect(page.isShowModal.value).toBe(true);
    expect(page.errorMessages.value).toEqual([
      "ログインIDまたはパスワードが正しくありません。",
    ]);
  });

  it("契約済みの入力エラーだけをBackend順で表示する", async () => {
    mocks.userStore.authLogin.mockRejectedValue(
      new AuthApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "loginId",
            message: "ログインIDを入力してください。",
          },
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "password",
            message: "パスワードを入力してください。",
          },
        ],
      })
    );
    const page = useLoginPage();

    await page.submitForm();

    expect(page.errorMessages.value).toEqual([
      "ログインIDを入力してください。",
      "パスワードを入力してください。",
    ]);
  });

  it("未知codeを含む入力エラーはBackend本文を表示しない", async () => {
    mocks.userStore.authLogin.mockRejectedValue(
      new AuthApiError(400, {
        fieldErrors: [
          {
            errorCode: "INTERNAL_LOGIN_DETAIL",
            field: "password",
            message: "内部認証方式の詳細",
          },
        ],
      })
    );
    const page = useLoginPage();

    await page.submitForm();

    expect(page.errorMessages.value).toEqual([
      "ログイン情報を確認してください。",
    ]);
  });

  it("本文なし403をSession失効とみなさず再読込案内へ変換する", async () => {
    mocks.userStore.authLogin.mockRejectedValue(new AuthApiError(403, null));
    const page = useLoginPage();

    await page.submitForm();

    expect(page.errorMessages.value).toEqual([
      "ログインの準備を更新できませんでした。画面を再読み込みしてお試しください。",
    ]);
  });

  it("ログイン成功後にSessionを復元できなければ画面遷移しない", async () => {
    mocks.userStore.authLogin.mockResolvedValue(false);
    const page = useLoginPage();

    await page.submitForm();

    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual([
      "ログイン後の利用者情報を確認できませんでした。もう一度お試しください。",
    ]);
  });

  it("Backend接続失敗は固定の接続エラーを表示する", async () => {
    mocks.userStore.authLogin.mockRejectedValue(new TypeError("offline"));
    const page = useLoginPage();

    await page.submitForm();

    expect(page.errorMessages.value).toEqual(["Backendへ接続できませんでした。"]);
  });

  it("ログイン処理中の二重送信を行わない", async () => {
    let resolveLogin;
    mocks.userStore.authLogin.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );
    const page = useLoginPage();

    const firstSubmission = page.submitForm();
    const secondSubmission = page.submitForm();

    expect(mocks.userStore.authLogin).toHaveBeenCalledOnce();
    resolveLogin(true);
    await Promise.all([firstSubmission, secondSubmission]);
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
