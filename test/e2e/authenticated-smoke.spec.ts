import { expect, test } from "./fixtures/test";

test("認証済みSessionでDashboardを再読込しても表示を維持する", async ({
  page,
}) => {
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
