import { expect, test } from "./fixtures/test";

test("未認証利用者へログイン画面を表示する", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByPlaceholder("ログインID")).toBeVisible();
  await expect(page.getByPlaceholder("パスワード")).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "ログイン", exact: true })).toBeVisible();
});

test("未認証で保護画面へ入るとログインへ戻し、理由を画面内に出す", async ({ page }) => {
  let dialogCount = 0;
  page.on("dialog", async (dialog) => {
    dialogCount += 1;
    await dialog.dismiss();
  });

  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("alert")).toContainText("この画面を開くにはログインが必要です。");
  await expect(page.getByPlaceholder("ログインID")).toBeVisible();
  expect(dialogCount).toBe(0);
});

test("認証失敗でアカウントの存在を公開しない", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("ログインID").fill("missing-browser-user");
  await page.getByPlaceholder("パスワード").fill("wrong-password");

  await page.getByRole("button", { name: "ログイン", exact: true }).click();

  await expect(page.getByText("ログインIDまたはパスワードが正しくありません。")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("未認証でもCSRF保護付き問い合わせを入力検査できる", async ({ page }) => {
  await page.goto("/inquiry");
  await page.getByLabel("メールアドレス(必須)").fill("invalid");

  await page.getByRole("button", { name: "送信する" }).click();

  await expect(page.getByText("不正なメールアドレスです。")).toBeVisible();
  await expect(page.getByText("お問い合わせを送信しました。")).not.toBeVisible();
});
