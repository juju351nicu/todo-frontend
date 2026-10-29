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
