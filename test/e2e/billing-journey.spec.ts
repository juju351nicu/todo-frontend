import { type BrowserContext, type Page } from "@playwright/test";

import { expect, test } from "./fixtures/test";
import { runBrowserRegressionFixture } from "./support/databaseFixture";
import { BILLING_AUTH_STATE_PATH } from "./support/paths";

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:8030";
const PROVIDER_UNAVAILABLE_MESSAGE =
  "現在、課金サービスを利用できません。時間を置いて再度お試しください。";

/** Browser内のCSRF Cookieを使ってBackendへJSON更新Requestを送り、statusだけを返す。 */
const postWithCsrf = async (page: Page, path: string, body: unknown): Promise<number> =>
  page.evaluate(
    async ({ backendUrl, requestPath, requestBody }) => {
      const csrfCookie = document.cookie
        .split(";")
        .map((value) => value.trim())
        .find((value) => value.startsWith("XSRF-TOKEN="));
      if (!csrfCookie) {
        throw new Error("CSRF Cookieがありません。");
      }
      const csrfToken = decodeURIComponent(csrfCookie.substring("XSRF-TOKEN=".length));
      const response = await fetch(`${backendUrl}${requestPath}`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": csrfToken,
        },
        body: requestBody === null ? undefined : JSON.stringify(requestBody),
      });
      return response.status;
    },
    { backendUrl: BACKEND_URL, requestPath: path, requestBody: body }
  );

/** 課金本人の認証状態を持つ追加Browser contextを生成する。 */
const createBillingContext = (browserContextFactory: {
  newContext(options: { storageState: string }): Promise<BrowserContext>;
}): Promise<BrowserContext> =>
  browserContextFactory.newContext({ storageState: BILLING_AUTH_STATE_PATH });

test("FreeからPro表示、管理照合、資格取消を認証済みSessionへ反映する", async ({
  browser,
  page,
}) => {
  const billingContext = await createBillingContext(browser);
  const billingPage = await billingContext.newPage();
  const secondBillingPage = await billingContext.newPage();
  const unauthenticatedContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const unauthenticatedPage = await unauthenticatedContext.newPage();

  try {
    await billingPage.goto("/billing");
    await expect(
      billingPage.getByRole("main").getByText("料金・契約", { exact: true })
    ).toBeVisible();
    await expect(billingPage.getByText("契約なし", { exact: true })).toBeVisible();
    await expect(billingPage.getByRole("button", { name: "ProのCheckoutへ進む" })).toBeVisible();

    await billingPage.goto("/administration/billing");
    await expect(billingPage).toHaveURL(/\/forbidden$/);
    await expect(billingPage.getByRole("heading", { name: "403: 権限がありません" })).toBeVisible();

    await billingPage.goto("/billing");
    await billingPage.getByRole("button", { name: "ProのCheckoutへ進む" }).click();
    await expect(
      billingPage.getByText(PROVIDER_UNAVAILABLE_MESSAGE, { exact: true })
    ).toBeVisible();

    runBrowserRegressionFixture("billing", "set-active");
    await billingPage.goto("/billing?checkout=success");
    await expect(
      billingPage.getByText("Pro契約が反映されました。有料機能を利用できます。", {
        exact: true,
      })
    ).toBeVisible();
    await expect(billingPage.getByText("契約中", { exact: true })).toBeVisible();
    await expect(billingPage.getByText("繰り返しTask", { exact: true })).toHaveCount(2);
    await expect(billingPage.getByText("Task・Project Template管理", { exact: true })).toHaveCount(
      2
    );
    await expect(billingPage.getByText("高度Dashboard", { exact: true })).toHaveCount(2);
    await expect(billingPage.getByRole("button", { name: "請求情報を管理" })).toBeVisible();

    const conflictStatus = await postWithCsrf(billingPage, "/api/v1/billing/checkout-sessions", {
      planCode: "PRO",
      billingInterval: "MONTHLY",
    });
    expect(conflictStatus).toBe(409);

    await billingPage.getByRole("button", { name: "請求情報を管理" }).click();
    await expect(
      billingPage.getByText(PROVIDER_UNAVAILABLE_MESSAGE, { exact: true })
    ).toBeVisible();

    await page.goto("/administration/billing");
    await expect(page.getByRole("main").getByText("課金管理", { exact: true })).toBeVisible();
    const billingAccountRow = page.getByRole("row").filter({ hasText: "Billing Browser" });
    await expect(billingAccountRow).toHaveCount(1);
    await expect(billingAccountRow.getByText("Customer 設定済み", { exact: true })).toBeVisible();
    await expect(billingAccountRow.getByText("Pro", { exact: true })).toBeVisible();

    runBrowserRegressionFixture("billing", "claim-reconciliation");
    await billingAccountRow.getByRole("button", { name: /課金状態をStripeと再照合/ }).click();
    await expect(
      page.getByText("課金状態が更新されています。状態を再取得してください。", { exact: true })
    ).toBeVisible();

    runBrowserRegressionFixture("billing", "clear-reconciliation-claim");
    await billingAccountRow.getByRole("button", { name: /課金状態をStripeと再照合/ }).click();
    await expect(page.getByText(PROVIDER_UNAVAILABLE_MESSAGE, { exact: true })).toBeVisible();

    await secondBillingPage.goto("/billing");
    await expect(secondBillingPage.getByText("契約中", { exact: true })).toBeVisible();
    runBrowserRegressionFixture("billing", "set-canceled");

    await secondBillingPage.reload();
    await expect(secondBillingPage.getByText("終了", { exact: true })).toBeVisible();
    await expect(
      secondBillingPage.getByText("現在利用できる有料機能はありません。", { exact: true })
    ).toBeVisible();
    await expect(
      secondBillingPage.getByRole("button", { name: "ProのCheckoutへ進む" })
    ).toBeVisible();

    await billingPage.getByRole("button", { name: "契約状態を再読み込み" }).click();
    await expect(billingPage.getByText("終了", { exact: true })).toBeVisible();
    await expect(billingPage).toHaveURL(/\/billing\?checkout=success$/);

    await unauthenticatedPage.goto("/billing");
    await expect(unauthenticatedPage).toHaveURL(/\/$/);
    await expect(unauthenticatedPage.getByRole("alert")).toContainText(
      "この画面を開くにはログインが必要です。"
    );
    await expect(
      unauthenticatedPage.getByRole("button", { name: "ログイン", exact: true })
    ).toBeVisible();

    const unauthorizedStatus = await unauthenticatedPage.evaluate(async (backendUrl) => {
      const response = await fetch(`${backendUrl}/api/v1/billing/me`, {
        credentials: "include",
      });
      return response.status;
    }, BACKEND_URL);
    expect(unauthorizedStatus).toBe(401);

    const forbiddenStatus = await billingPage.evaluate(async (backendUrl) => {
      const response = await fetch(`${backendUrl}/api/v1/administration/billing/accounts`, {
        credentials: "include",
      });
      return response.status;
    }, BACKEND_URL);
    expect(forbiddenStatus).toBe(403);

    if (process.env.E2E_SKIP_DATABASE_FIXTURE !== "true") {
      const inspection = runBrowserRegressionFixture("billing", "inspect-stage11d");
      expect(inspection).toContain("billing_ui_contract=1");
    }
  } finally {
    await unauthenticatedContext.close();
    await billingContext.close();
  }
});
