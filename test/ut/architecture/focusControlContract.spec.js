// @vitest-environment happy-dom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ATTENDANCE_ADMIN_CONTROL } from "@/features/attendance/composables/useAttendanceAdministrationPage";
import { ATTENDANCE_CONTROL } from "@/features/attendance/composables/useAttendancePage";
import { DASHBOARD_CONTROL } from "@/features/dashboard/composables/useDashboardPage";
import { PROJECT_SETTINGS_CONTROL } from "@/features/project/composables/useProjectSettingsDialog";
import { CAPTURE_NAME_CONTROL } from "@/features/project/composables/useProjectTemplateCapture";
import { PROJECT_TEMPLATE_CONTROL } from "@/features/project/composables/useProjectTemplatePage";
import { MY_TASKS_RELOAD_CONTROL } from "@/features/task/composables/useMyTasksPage";
import { COMMENT_COMPOSER_CONTROL } from "@/features/task/composables/useTaskComments";
import { TASK_SEARCH_CONTROL } from "@/features/task/composables/useTaskSearchPage";
import { TASK_TIMER_HISTORY_CONTROL } from "@/features/time-tracking/composables/useCurrentTaskTimer";
import { TODO_SUBMIT_CONTROL } from "@/features/todo/composables/useTodoDetailPage";
import { WBS_BASELINE_CONTROL } from "@/features/wbs/composables/useWbsBaselines";
import { EARNED_VALUE_SUBMIT_CONTROL } from "@/features/wbs/composables/useWbsEarnedValue";
import { WBS_TASK_EDITOR_CONTROL } from "@/features/wbs/composables/useWbsTaskEditor";
import { WORKING_CALENDAR_SUBMIT_CONTROL } from "@/features/wbs/composables/useWbsWorkingCalendar";
import { WORKLOAD_CONTROL } from "@/features/wbs/composables/useWbsWorkload";

/**
 * フォーカスの戻し先の契約：composableが`data-*`属性で探す部品に、templateが同じ属性名・同じ値を付けているか。
 *
 * composableのテストはselectorの文字列を確かめるだけなので、templateの属性名や値がずれても気づかない。
 * 画面全体をmountせずに、`.vue`のソースに「属性名="定数.key"」（または値の直書き）があるかを確かめる。
 */
const SOURCE_ROOT = join(process.cwd(), "src");

const listVueFiles = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return listVueFiles(path);
    }
    return path.endsWith(".vue") ? [path] : [];
  });

const VUE_SOURCES = listVueFiles(SOURCE_ROOT).map((path) => readFileSync(path, "utf8"));

/**
 * templateのどこかに、その属性を定数で（`:属性="定数.key"`）または値の直書きで（`属性="値"`）付けているか。
 */
const isRendered = (attribute, constantExpression, value) =>
  VUE_SOURCES.some(
    (source) =>
      source.includes(`:${attribute}="${constantExpression}"`) || source.includes(` ${attribute}="${value}"`)
  );

const GROUPED_CONTROLS = [
  ["data-attendance-admin-control", "ATTENDANCE_ADMIN_CONTROL", ATTENDANCE_ADMIN_CONTROL],
  ["data-attendance-control", "ATTENDANCE_CONTROL", ATTENDANCE_CONTROL],
  ["data-dashboard-control", "DASHBOARD_CONTROL", DASHBOARD_CONTROL],
  ["data-project-settings-control", "PROJECT_SETTINGS_CONTROL", PROJECT_SETTINGS_CONTROL],
  ["data-project-template-control", "PROJECT_TEMPLATE_CONTROL", PROJECT_TEMPLATE_CONTROL],
  ["data-task-search-control", "TASK_SEARCH_CONTROL", TASK_SEARCH_CONTROL],
  ["data-wbs-baseline-control", "WBS_BASELINE_CONTROL", WBS_BASELINE_CONTROL],
  ["data-wbs-task-editor-control", "WBS_TASK_EDITOR_CONTROL", WBS_TASK_EDITOR_CONTROL],
  ["data-workload-control", "WORKLOAD_CONTROL", WORKLOAD_CONTROL],
];

const SINGLE_CONTROLS = [
  ["data-project-template-capture", "CAPTURE_NAME_CONTROL", CAPTURE_NAME_CONTROL],
  ["data-my-task-control", "MY_TASKS_RELOAD_CONTROL", MY_TASKS_RELOAD_CONTROL],
  ["data-comment-control", "COMMENT_COMPOSER_CONTROL", COMMENT_COMPOSER_CONTROL],
  ["data-task-timer-control", "TASK_TIMER_HISTORY_CONTROL", TASK_TIMER_HISTORY_CONTROL],
  ["data-todo-detail-control", "TODO_SUBMIT_CONTROL", TODO_SUBMIT_CONTROL],
  ["data-earned-value-control", "EARNED_VALUE_SUBMIT_CONTROL", EARNED_VALUE_SUBMIT_CONTROL],
  ["data-working-calendar-control", "WORKING_CALENDAR_SUBMIT_CONTROL", WORKING_CALENDAR_SUBMIT_CONTROL],
];

describe("フォーカスの戻し先の属性の契約（composable と template）", () => {
  it.each(GROUPED_CONTROLS)("%s：%s の各keyがtemplateに付いている", (attribute, constantName, control) => {
    const missing = Object.entries(control)
      .filter(([key, value]) => !isRendered(attribute, `${constantName}.${key}`, value))
      .map(([key]) => key);

    expect(missing).toEqual([]);
  });

  it.each(SINGLE_CONTROLS)("%s：%s がtemplateに付いている", (attribute, constantName, value) => {
    expect(isRendered(attribute, constantName, value)).toBe(true);
  });
});
