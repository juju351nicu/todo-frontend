import { type Page } from "@playwright/test";

import { expect, test } from "./fixtures/test";
import { runBrowserRegressionFixture } from "./support/databaseFixture";

const PROJECT_KEY = "BROWSER-WBS-E2E";
const PROJECT_NAME = "Browser WBS Playwright";
const PLANNING_TASK_TITLE = "Browser WBS 設計";
const COMPLETED_TASK_TITLE = "Browser WBS 実装済み";
const ACCOUNT_DISPLAY_NAME = "WBS 確認者";
const BASELINE_NAME = "E2E計画";

/** Project一覧から専用Projectを選び、Boardの「WBSを開く」導線で採番IDに依存せずWBSを開く。 */
const openDedicatedWbs = async (page: Page): Promise<void> => {
  await page.goto("/projects");
  const projectCard = page.getByRole("article").filter({
    has: page.getByText(PROJECT_KEY, { exact: true }),
  });
  await projectCard.getByRole("button", { name: "Boardを開く" }).click();
  await expect(page).toHaveURL(/\/projects\/\d+\/board$/);
  // UButtonにtoを指定しているため、WBSへの導線はlinkとして描画される。
  await page.getByRole("link", { name: "WBSを開く" }).click();
  await expect(page).toHaveURL(/\/projects\/\d+\/wbs$/);
  await expect(page.getByRole("heading", { name: PROJECT_NAME })).toBeVisible();
};

test("WBSで日別予定を登録してworkloadへ反映し、見積もり精度・baseline・EVMを確認する", async ({
  page,
}) => {
  await openDedicatedWbs(page);

  // fixtureの完了Task（予定2時間・実績2時間30分）が、見積もり精度の一覧へ参考値として表示される。
  await expect(
    page.getByText("比較できたTaskが1件のため参考値です。", { exact: false })
  ).toBeVisible();
  const accuracyRow = page
    .getByRole("row")
    .filter({ hasText: `2 ${COMPLETED_TASK_TITLE}` })
    .filter({ hasText: "範囲外" });
  await expect(accuracyRow).toContainText("2時間30分");
  await expect(accuracyRow).toContainText("+30分");

  // Human Estimateを2 revision追記し、最新revisionの採用とFinal Plan反映を監査する。
  await page.getByRole("button", { name: `${PLANNING_TASK_TITLE}の見積もり履歴を開く` }).click();
  const estimateDialog = page.getByRole("dialog", {
    name: `Task見積もり: 1 ${PLANNING_TASK_TITLE}`,
  });
  await expect(estimateDialog).toBeVisible();
  await expect(
    estimateDialog.getByText("Final Plan（正式予定）").locator("..").getByText("4時間")
  ).toBeVisible();
  await expect(estimateDialog.getByText("Actual（実績）").locator("..")).toContainText("未入力");
  await estimateDialog.getByLabel("最頻値・単一点（分）").fill("360");
  await estimateDialog.getByRole("button", { name: "見積もりを追加", exact: true }).click();
  await expect(estimateDialog.getByText("Human Estimateを保存しました。")).toBeVisible();

  await estimateDialog.getByLabel("楽観値（分）").fill("300");
  await estimateDialog.getByLabel("最頻値・単一点（分）").fill("360");
  await estimateDialog.getByLabel("悲観値（分）").fill("480");
  await estimateDialog.getByRole("button", { name: "見積もりを追加", exact: true }).click();
  const estimateHistoryTable = estimateDialog.locator("table").first();
  await expect(estimateHistoryTable.getByRole("row")).toHaveCount(3);
  await expect(estimateHistoryTable.getByRole("row").nth(1)).toContainText("6時間");
  await expect(estimateHistoryTable.getByRole("row").nth(2)).toContainText("5時間 / 6時間 / 8時間");

  await estimateDialog.getByRole("button", { name: "採否を確定", exact: true }).click();
  await expect(
    estimateDialog.getByText("見積もりをFinal Planへ反映し、採否履歴へ保存しました。")
  ).toBeVisible();
  await expect(
    estimateDialog.getByText("Final Plan（正式予定）").locator("..").getByText("6時間")
  ).toBeVisible();
  const decisionHistoryTable = estimateDialog.locator("table").nth(1);
  await expect(decisionHistoryTable.getByRole("row")).toHaveCount(2);
  await expect(decisionHistoryTable.getByRole("row").nth(1)).toContainText("revision 2");
  await expect(decisionHistoryTable.getByRole("row").nth(1)).toContainText("そのまま採用");
  await expect(decisionHistoryTable.getByRole("row").nth(1)).toContainText("4時間 → 6時間");
  await expect(decisionHistoryTable.getByRole("row").nth(1)).toContainText("0 → 1");
  await estimateDialog.getByRole("button", { name: "閉じる", exact: true }).click();

  await page.reload();
  await page.getByRole("button", { name: `${PLANNING_TASK_TITLE}の見積もり履歴を開く` }).click();
  await expect(estimateDialog.locator("table").first().getByRole("row")).toHaveCount(3);
  await expect(estimateDialog.locator("table").first().getByRole("row").nth(1)).toContainText(
    "Human Estimate"
  );
  await expect(estimateDialog.locator("table").first().getByRole("row").nth(2)).toContainText(
    "Human Estimate"
  );
  await expect(estimateDialog.locator("table").nth(1).getByRole("row")).toHaveCount(2);
  await estimateDialog.getByRole("button", { name: "閉じる", exact: true }).click();

  // 完了TaskではHuman Estimateと実利用した支援方法・誤差理由を評価revisionへ固定する。
  await page.getByRole("button", { name: `${COMPLETED_TASK_TITLE}の見積もり履歴を開く` }).click();
  const completedEstimateDialog = page.getByRole("dialog", {
    name: `Task見積もり: 2 ${COMPLETED_TASK_TITLE}`,
  });
  await expect(completedEstimateDialog.getByText("完了Taskを評価", { exact: true })).toBeVisible();
  await completedEstimateDialog
    .getByRole("combobox", { name: "想定するAI支援", exact: true })
    .click();
  await page.getByRole("option", { name: "Coding Agent", exact: true }).click();
  await completedEstimateDialog.getByLabel("最頻値・単一点（分）").fill("120");
  await completedEstimateDialog
    .getByRole("button", { name: "見積もりを追加", exact: true })
    .click();
  await expect(completedEstimateDialog.getByText("Human Estimateを保存しました。")).toBeVisible();

  await completedEstimateDialog
    .getByRole("combobox", { name: "実際に利用したAI支援", exact: true })
    .click();
  await page.getByRole("option", { name: "Coding Agent", exact: true }).click();
  await completedEstimateDialog
    .getByRole("combobox", { name: "Final PlanとActualの誤差理由", exact: true })
    .click();
  await page.getByRole("option", { name: "テスト範囲の増加", exact: true }).click();
  await completedEstimateDialog.getByLabel("誤差理由の補足").fill("テスト範囲を追加");
  await completedEstimateDialog.getByRole("button", { name: "評価を保存", exact: true }).click();
  await expect(
    completedEstimateDialog.getByText("完了Taskの見積もり評価を保存しました。")
  ).toBeVisible();
  const outcomeHistoryTable = completedEstimateDialog.locator("table").nth(1);
  await expect(outcomeHistoryTable.getByRole("row")).toHaveCount(2);
  await expect(outcomeHistoryTable.getByRole("row").nth(1)).toContainText("revision 1・2時間");
  await expect(outcomeHistoryTable.getByRole("row").nth(1)).toContainText("2時間 / 2時間30分");
  await expect(outcomeHistoryTable.getByRole("row").nth(1)).toContainText("Coding Agent");
  await expect(outcomeHistoryTable.getByRole("row").nth(1)).toContainText("テスト範囲の増加");
  await expect(outcomeHistoryTable.getByRole("row").nth(1)).toContainText("テスト範囲を追加");
  await completedEstimateDialog.getByRole("button", { name: "閉じる", exact: true }).click();

  const outcomeComparison = page.getByRole("region", { name: "評価revision比較" });
  await expect(outcomeComparison.getByText("評価済み 1件", { exact: true })).toBeVisible();
  await expect(
    outcomeComparison.getByText("ペア比較できたTask", { exact: true }).locator("..")
  ).toContainText("1件");
  await expect(
    outcomeComparison.getByText("Human Estimate未入力", { exact: true }).locator("..")
  ).toContainText("0件");
  await expect(outcomeComparison).toContainText("ペア比較できたTaskが1件のため参考値です。");
  const humanAccuracy = outcomeComparison
    .getByText("Human Estimate", { exact: true })
    .locator("..");
  await expect(humanAccuracy).toContainText("絶対誤差の平均30分");
  await expect(humanAccuracy).toContainText("30分");
  await expect(humanAccuracy).toContainText("0 / 1件（0%）");
  const finalPlanAccuracy = outcomeComparison
    .getByText("Final Plan", { exact: true })
    .locator("..");
  await expect(finalPlanAccuracy).toContainText("絶対誤差の平均30分");
  await expect(finalPlanAccuracy).toContainText("30分");
  await expect(finalPlanAccuracy).toContainText("0 / 1件（0%）");
  await expect(outcomeComparison.getByText("Coding Agent 1件", { exact: true })).toBeVisible();
  await expect(outcomeComparison.getByText("テスト範囲の増加 1件", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("region", { name: "評価revision比較" })).toContainText(
    "評価済み 1件"
  );
  await page.getByRole("button", { name: `${COMPLETED_TASK_TITLE}の見積もり履歴を開く` }).click();
  await expect(completedEstimateDialog.locator("table").nth(1).getByRole("row")).toHaveCount(2);
  await completedEstimateDialog.getByRole("button", { name: "閉じる", exact: true }).click();

  // 未完了Taskへ日別予定（90分）を登録すると、Dialogを閉じなくてもworkloadが再集計される。
  await page.getByRole("button", { name: `${PLANNING_TASK_TITLE}の日別予定工数を開く` }).click();
  // Dialog名にはWBSコードが前置される（例: "Task日別予定工数: 1 Browser WBS 設計"）。
  const effortPlanDialog = page.getByRole("dialog", {
    name: `Task日別予定工数: 1 ${PLANNING_TASK_TITLE}`,
  });
  await expect(effortPlanDialog).toBeVisible();
  await effortPlanDialog.getByLabel("予定工数（分）").fill("90");
  await effortPlanDialog.getByRole("button", { name: "登録", exact: true }).click();
  await expect(effortPlanDialog.getByText("Task日別予定を登録しました。")).toBeVisible();
  await effortPlanDialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(effortPlanDialog).toBeHidden();

  // workloadには、fixtureの前日の実績行と、今回登録した今日の予定行が並ぶ。
  const plannedWorkloadRow = page
    .getByRole("row")
    .filter({ hasText: ACCOUNT_DISPLAY_NAME })
    .filter({ hasText: "1時間30分" });
  await expect(plannedWorkloadRow).toHaveCount(1);

  // OWNERは現在計画をbaselineとして保存でき、active baseline基準のEVMを集計できる。
  await page.getByRole("button", { name: "現在計画を保存" }).click();
  const baselineDialog = page.getByRole("dialog", { name: "WBS baselineを作成" });
  await expect(baselineDialog).toBeVisible();
  await baselineDialog.getByLabel("baseline名").fill(BASELINE_NAME);
  await baselineDialog.getByRole("button", { name: "作成", exact: true }).click();
  await expect(baselineDialog).toBeHidden();
  await expect(page.getByText(`baseline「${BASELINE_NAME}」を作成しました`)).toBeVisible();

  const earnedValueForm = page.locator("form").filter({ has: page.getByLabel("EVM基準日") });
  await earnedValueForm.getByRole("button", { name: "集計", exact: true }).click();
  await expect(page.getByText("BAC（総予算）")).toBeVisible();

  if (process.env.E2E_SKIP_DATABASE_FIXTURE !== "true") {
    const inspection = runBrowserRegressionFixture("wbs-journey", "inspect-stage10d2");
    expect(inspection).toContain("human_estimate_revision_count=2");
    expect(inspection).toContain("estimate_decision_count=1");
    expect(inspection).toContain("estimate_decision_task_result_count=1");
    expect(inspection).toContain("estimate_outcome_count=1");
  }
});
