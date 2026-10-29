/**
 * コメントに資料の番号の書き方（改善提案の番号・動作確認の項目のパス・動作確認資料の略称・開発段階名・§番号）が
 * 残っているファイルと件数。`repositoryConvention.spec.js`が、この値と実際の件数の一致を検査する。
 * コメントを業務上の意味と理由の文へ書き直して件数が減ったら、同じ変更でこの値も減らす（0になった行は消す）。
 * 新しいファイル・行を足してはいけない（`docs/coding-guidelines.md`「資料を知らない人が読めるコメントにする」）。
 */
export const INTERNAL_DOCUMENT_REFERENCE_BASELINE = Object.freeze({
  "src/features/wbs/components/WbsTaskEditDialog.vue": 1,
  "src/features/wbs/components/WorkingCalendarCard.vue": 1,
  "src/features/wbs/composables/useWbsBaselines.ts": 2,
  "src/features/wbs/composables/useWbsEarnedValue.ts": 1,
  "src/features/wbs/composables/useWbsReportExport.ts": 1,
  "src/features/wbs/composables/useWbsTaskEditor.ts": 3,
  "src/features/wbs/composables/useWbsWorkingCalendar.ts": 5,
  "src/features/wbs/composables/useWbsWorkload.ts": 1,
  "src/features/wbs/utils/earnedValue.ts": 1,
  "src/features/wbs/utils/taskWorkload.ts": 1,
  "src/features/wbs/utils/wbsBaseline.ts": 1,
  "test/e2e/authorization-journey.spec.ts": 1,
  "test/e2e/task-recurrence-journey.spec.ts": 1,
  "test/ut/features/attendance/composables/useAttendancePage.spec.js": 1,
  "test/ut/features/dashboard/utils/dashboard.spec.js": 1,
  "test/ut/features/project/api/projectApi.spec.js": 1,
  "test/ut/features/project/composables/useProjectListPage.spec.js": 1,
  "test/ut/features/project/composables/useProjectSettingsDialog.spec.js": 1,
  "test/ut/features/project/utils/projectTemplateDisplay.spec.js": 1,
  "test/ut/features/task/composables/useTaskBoardPage.spec.js": 2,
  "test/ut/features/task/composables/useTaskSearchPage.spec.js": 1,
  "test/ut/features/task/composables/useTodoDetailPage.spec.js": 1,
  "test/ut/features/time-tracking/composables/useCurrentTaskTimer.spec.js": 1,
  "test/ut/features/wbs/composables/useWbsTaskEditor.spec.js": 1,
});
