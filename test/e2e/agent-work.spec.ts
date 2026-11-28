import { expect, test, type Page, type Route } from "@playwright/test";

const NOW = "2026-11-28T14:00:00Z";
const FIRST = "11111111-1111-4111-8111-111111111111";
const SECOND = "22222222-2222-4222-8222-222222222222";
const SESSIONS = [
  {
    sessionId: FIRST,
    projectId: 1,
    taskId: 15,
    workspacePath: "/workspace/optimus",
    agentName: "Codex",
    threadLabel: "Optimus移行",
    gitHead: null,
    statusCode: "RUNNING",
    startedAt: NOW,
    lastHeartbeatAt: NOW,
    endedAt: null,
    stale: false,
    elapsedSeconds: 60,
    version: 0,
  },
  {
    sessionId: SECOND,
    projectId: 2,
    taskId: 20,
    workspacePath: "/workspace/dinos/" + "長い作業場所".repeat(35),
    agentName: "Codex",
    threadLabel: "DINOS調査",
    gitHead: null,
    statusCode: "RUNNING",
    startedAt: NOW,
    lastHeartbeatAt: NOW,
    endedAt: null,
    stale: true,
    elapsedSeconds: 1200,
    version: 1,
  },
];

/** Sessionと業務応答を合成し、実DB・資格情報・外部参照を使わず表示と操作を確認する。 */
const mockApplication = async (
  page: Page,
  options: { empty?: boolean; unauthorized?: boolean; readable?: boolean } = {}
): Promise<void> => {
  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const headers = {
      "access-control-allow-origin": new URL(
        page.url() === "about:blank" ? "http://localhost:8081" : page.url()
      ).origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,x-xsrf-token",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    let body: unknown = {};
    if (url.pathname.endsWith("/session"))
      body = {
        accountId: 1,
        username: "ui-agent-test",
        displayName: "UI検証",
        roleCodes: ["USER"],
        permissionCodes: options.readable === false ? [] : ["TASK_READ"],
      };
    else if (url.pathname.endsWith("/time-tracking/current"))
      body = { serverTime: NOW, timer: null };
    else if (url.pathname.endsWith("/notifications"))
      body = {
        unreadEventCount: 0,
        unresolvedAlertCount: 0,
        badgeCount: 0,
        events: [],
        alerts: [],
        generatedAt: NOW,
      };
    else if (url.pathname === "/api/v1/agent-sessions") {
      if (options.unauthorized) {
        await route.fulfill({ status: 401, headers });
        return;
      }
      const sessions =
        options.empty || url.searchParams.get("statusCode") === "FINISHED" ? [] : SESSIONS;
      body = { sessions, totalElements: sessions.length, serverTime: NOW };
    } else if (url.pathname.endsWith("/records")) {
      body = {
        records: [
          {
            recordId: 1,
            sessionId: FIRST,
            kind: "VERIFICATION",
            summary: "検証結果を保存しました",
            verification: "<img src=x onerror=alert(1)>",
            artifacts: "https://example.invalid/do-not-fetch",
            gitHead: null,
            recordedAt: NOW,
          },
        ],
        totalElements: 1,
      };
    }
    await route.fulfill({ json: body, headers });
  });
};

test("並行する案件・応答待ち・成果を表示し参照本文をHTMLとして実行しない", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().startsWith("https://example.invalid")) external.push(request.url());
  });
  await mockApplication(page);
  await page.goto("/agent-work");
  await expect(page.getByRole("heading", { name: "AI作業", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "メニューを開く" }).click();
  await expect(page.getByRole("link", { name: "AI作業", exact: true })).toHaveAttribute(
    "href",
    "/agent-work"
  );
  await page.getByRole("button", { name: "メニューを開く" }).click();
  await expect(page.getByRole("heading", { name: "Optimus移行" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "DINOS調査" })).toBeVisible();
  await expect(page.getByText("応答待ち", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Optimus移行の成果・検証を見る" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("検証結果を保存しました")).toBeVisible();
  await expect(dialog.getByText("<img src=x onerror=alert(1)>", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("https://example.invalid/do-not-fetch", { exact: true })
  ).toBeVisible();
  await expect(dialog.locator("img")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("ai-work-desktop.png"), fullPage: true });
});

test("状態filterで終了済みの空一覧へ切り替える", async ({ page }) => {
  await mockApplication(page);
  await page.goto("/agent-work");
  await expect(page.getByRole("heading", { name: "Optimus移行" })).toBeVisible();
  await page.getByRole("combobox", { name: "状態" }).click();
  await page.getByRole("option", { name: "終了", exact: true }).click();
  await expect(page.getByText("この条件のAI作業はありません。")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Optimus移行" })).toHaveCount(0);
});

test("空一覧でも人の実績とAI区間の違いを案内する", async ({ page }) => {
  await mockApplication(page, { empty: true });
  await page.goto("/agent-work");
  await expect(page.getByText("この条件のAI作業はありません。")).toBeVisible();
  await expect(page.getByText(/人の実績工数には加算されません/)).toBeVisible();
  await expect(page.getByRole("button", { name: "次へ", exact: true })).toBeDisabled();
});

test("スマートフォン幅でも長い作業pathで画面全体が横へはみ出さない", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApplication(page);
  await page.goto("/agent-work");
  await expect(page.getByRole("heading", { name: "DINOS調査" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await page.screenshot({ path: testInfo.outputPath("ai-work-mobile.png"), fullPage: true });
});

test("参照中の401でログインへ戻り旧案件を残さない", async ({ page }) => {
  await mockApplication(page, { unauthorized: true });
  await page.goto("/agent-work");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Optimus移行" })).toHaveCount(0);
});

test("TASK_READなしではAI作業の取得を行わない", async ({ page }) => {
  const reads: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/agent-sessions") reads.push(request.url());
  });
  await mockApplication(page, { readable: false });
  await page.goto("/agent-work");
  await expect(page).toHaveURL(/forbidden/);
  expect(reads).toEqual([]);
});
