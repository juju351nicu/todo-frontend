import type { TaskRecurrenceFrequency } from "@/features/task/types/taskRecurrence";

/**
 * Task（Board・Template・繰り返し・checklist・コメント・検索）の入力の上限。
 *
 * BackendのRequest DTO（`@Size`・`@Max`）と保存する列の長さと同じ値にする
 * （Backendの`task/domain/TaskFieldLimits`）。画面の検証・`maxlength`・`FieldCounter`・文言はこの定数を使う。
 * 文字数はtrim後の長さで比べる。
 */

/** Taskの件名の最大文字数。 */
export const TASK_TITLE_MAX_LENGTH = 45;

/** Taskの詳細の最大文字数。 */
export const TASK_DETAIL_MAX_LENGTH = 1000;

/** Template・繰り返し規則で、開始日から期限までに置ける最大の日数（期限オフセット）。 */
export const TASK_DUE_OFFSET_MAX_DAYS = 365;

/** 繰り返し規則で、発生日の何日前からTaskを作っておくか（生成先行日数）の最大日数。 */
export const TASK_RECURRENCE_GENERATION_LEAD_MAX_DAYS = 90;

/** 繰り返し規則の頻度ごとの間隔の上限（日次は日、週次は週、月次は月）。 */
export const TASK_RECURRENCE_INTERVAL_MAX: Readonly<Record<TaskRecurrenceFrequency, number>> = {
  DAILY: 365,
  WEEKLY: 52,
  MONTHLY: 24,
};

/** Task Templateの名前の最大文字数。 */
export const TASK_TEMPLATE_NAME_MAX_LENGTH = 100;

/** チェック項目本文の最大文字数。 */
export const CHECKLIST_ITEM_MAX_LENGTH = 255;

/** 1つのTask（Template・繰り返し規則を含む）に登録できるチェック項目の最大件数。 */
export const CHECKLIST_ITEM_MAX_COUNT = 50;

/** コメント本文の最大文字数。 */
export const TASK_COMMENT_MAX_LENGTH = 2000;

/** Task横断検索のキーワードの最大文字数。 */
export const TASK_SEARCH_KEYWORD_MAX_LENGTH = 100;

/** Saved Viewの名前の最大文字数。 */
export const TASK_SAVED_VIEW_NAME_MAX_LENGTH = 100;
