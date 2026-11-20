import { expect, test } from "./fixtures/test";

test("認証済みSessionでDashboardを再読込しても表示を維持する", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", { name: "Dashboard 確認者さんのDashboard" })
  ).toBeVisible();
  await expect(page.getByText("未完了 4件", { exact: true })).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Dashboard 確認者さんのDashboard" })
  ).toBeVisible();
});

test.describe("CSRFの認証境界", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("CSRF Cookieなしでログイン・ログアウト・再ログインできる", async ({ page }) => {
    await page.goto("/");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await page
        .getByPlaceholder("ログインID")
        .fill(process.env.E2E_LOGIN_ID ?? "dashboard-browser");
      await page.getByPlaceholder("パスワード").fill(process.env.E2E_PASSWORD ?? "password");
      await page.getByRole("button", { name: "ログイン", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { name: /Dashboard$/ })).toBeVisible();
      const cookies = await page.context().cookies();
      expect(cookies.some((cookie) => cookie.name === "JSESSIONID" && cookie.httpOnly)).toBe(true);
      expect(cookies.some((cookie) => cookie.name === "XSRF-TOKEN")).toBe(false);

      await page.getByRole("button", { name: "メニューを開く", exact: true }).click();
      const [logoutResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/api/v1/logout" &&
            response.request().method() === "POST"
        ),
        page.getByRole("button", { name: "ログアウト", exact: true }).click(),
      ]);
      expect(logoutResponse.status()).toBe(204);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByPlaceholder("ログインID")).toBeVisible();
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/$/);
    }
  });
});
