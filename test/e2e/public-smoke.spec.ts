import { expect, test } from "./fixtures/test";

test("未認証利用者へログイン画面を表示する", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByPlaceholder("ログインID")).toBeVisible();
  await expect(page.getByPlaceholder("パスワード")).toHaveAttribute(
    "type",
    "password"
  );
  await expect(
    page.getByRole("button", { name: "ログイン", exact: true })
  ).toBeVisible();
});

test("未認証で保護画面へ入るとログインへ戻す", async ({ page }) => {
  let dialogMessage = "";
  page.once("dialog", async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.accept();
  });

  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/$/);
  expect(dialogMessage).toBe("ログインが必要です");
  await expect(page.getByPlaceholder("ログインID")).toBeVisible();
});
