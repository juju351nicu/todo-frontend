import { type Browser, type BrowserContext, type Page } from "@playwright/test";

import { expect, test } from "./fixtures/test";
import { runBrowserRegressionFixture } from "./support/databaseFixture";
import {
  ATTENDANCE_MONTH_CLOSER_AUTH_STATE_PATH,
  ATTENDANCE_MONTH_REVIEWER_AUTH_STATE_PATH,
} from "./support/paths";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8081";

/** 保存済み認証状態から、月次確認用の独立browser contextを作る。 */
const createContext = async (
  browser: Browser,
  storageState: string
): Promise<BrowserContext> =>
  browser.newContext({
    baseURL: BASE_URL,
    locale: "ja-JP",
    storageState,
    timezoneId: "Asia/Tokyo",
  });

/** 管理画面の専用本人rowを選択し、月次詳細の読込完了を待つ。 */
const selectEmployeeMonth = async (page: Page): Promise<void> => {
  const employeeRow = page.getByRole("button", {
    name: /勤怠 月次本人の\d{4}-\d{2}勤怠を表示/,
  });
  await expect(employeeRow).toHaveCount(1);
  await employeeRow.click();
  await expect(
    page.locator(".attendance-administration-detail").getByText("8時間", {
      exact: true,
    })
  ).toBeVisible();
};

test("本人提出から差戻し・再提出・承認・締めまで月次状態を引き継ぐ", async ({
  browser,
  page: employeePage,
}) => {
  const reviewerContext = await createContext(
    browser,
    ATTENDANCE_MONTH_REVIEWER_AUTH_STATE_PATH
  );
  const closerContext = await createContext(
    browser,
    ATTENDANCE_MONTH_CLOSER_AUTH_STATE_PATH
  );
  const reviewerPage = await reviewerContext.newPage();
  const closerPage = await closerContext.newPage();

  try {
    await employeePage.goto("/attendance");
    await expect(employeePage.getByText("月次申請")).toBeVisible();
    await expect(
      employeePage.getByText("下書き", { exact: true })
    ).toBeVisible();
    await employeePage
      .getByRole("button", { name: "提出", exact: true })
      .click();
    await expect(
      employeePage.getByText("月次勤怠を提出しました。", { exact: true })
    ).toBeVisible();
    await employeePage.reload();
    await expect(
      employeePage.getByText("提出済み", { exact: true })
    ).toBeVisible();

    await reviewerPage.goto("/attendance/administration");
    await expect(
      reviewerPage.locator(
        ".attendance-administration-page > .v-card > .v-card-title"
      )
    ).toBeVisible();
    await selectEmployeeMonth(reviewerPage);
    await reviewerPage
      .getByRole("button", { name: "差戻し", exact: true })
      .click();
    await expect(
      reviewerPage.getByText("差戻し理由を入力してください。", {
        exact: true,
      })
    ).toBeVisible();
    await reviewerPage
      .getByLabel("差戻し理由（必須）")
      .fill("退勤時刻を確認してください");
    await reviewerPage
      .getByRole("button", { name: "差戻し", exact: true })
      .click();
    await expect(
      reviewerPage.getByText("勤怠月を差し戻しました。", { exact: true })
    ).toBeVisible();

    await employeePage.reload();
    await expect(
      employeePage.getByText(
        "差戻し理由: 退勤時刻を確認してください",
        { exact: true }
      )
    ).toBeVisible();
    await employeePage
      .getByRole("button", { name: "再提出", exact: true })
      .click();
    await expect(
      employeePage.getByText("月次勤怠を提出しました。", { exact: true })
    ).toBeVisible();

    await reviewerPage.reload();
    await selectEmployeeMonth(reviewerPage);
    await reviewerPage.getByLabel("承認コメント（任意）").fill("確認済み");
    await reviewerPage
      .getByRole("button", { name: "承認", exact: true })
      .click();
    await expect(
      reviewerPage.getByText("勤怠月を承認しました。", { exact: true })
    ).toBeVisible();
    await expect(
      reviewerPage.getByRole("button", {
        name: "月次を締める",
        exact: true,
      })
    ).toHaveCount(0);

    await closerPage.goto("/attendance/administration");
    await selectEmployeeMonth(closerPage);
    await closerPage
      .getByRole("button", { name: "月次を締める", exact: true })
      .click();
    await expect(
      closerPage.getByText("勤怠月を締めました。", { exact: true })
    ).toBeVisible();
    await closerPage.reload();
    await selectEmployeeMonth(closerPage);
    await expect(
      closerPage
        .locator(".attendance-administration-detail")
        .getByText(/version 5/)
    ).toBeVisible();

    if (process.env.E2E_SKIP_DATABASE_FIXTURE !== "true") {
      const inspection = runBrowserRegressionFixture(
        "attendance-month",
        "inspect-stage10d2"
      );
      expect(inspection).toContain("month_contract=1");
      expect(inspection).toContain("audit_contract=1");
      expect(inspection).toContain("work_contract=1");
      expect(inspection).toContain("fixture_structure=3,1,1,5");
    }
  } finally {
    await Promise.all([reviewerContext.close(), closerContext.close()]);
  }
});
