/**
 * Project・Project Templateの入力の上限と形式。
 *
 * BackendのRequest DTO（`ProjectCreateRequest`・`ProjectUpdateRequest`・Project TemplateのRequest）と、
 * 保存する列の長さと同じ値にする。画面の検証・`maxlength`・`FieldCounter`・文言はこの定数を使う。
 * 文字数はtrim後の長さで比べる。
 */

/** Projectキーの最大文字数。 */
export const PROJECT_KEY_MAX_LENGTH = 30;

/** Projectキーの形式。大文字英数字をハイフンで区切る（例: `SALES-2026`）。先頭・末尾・連続のハイフンは不可。 */
export const PROJECT_KEY_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

/** Project名の最大文字数。 */
export const PROJECT_NAME_MAX_LENGTH = 100;

/** Projectの説明の最大文字数。 */
export const PROJECT_DESCRIPTION_MAX_LENGTH = 2000;

/** Project Templateの名前の最大文字数。 */
export const PROJECT_TEMPLATE_NAME_MAX_LENGTH = 100;

/** Project Templateの説明（生成するProjectへ複製する説明）の最大文字数。 */
export const PROJECT_TEMPLATE_DESCRIPTION_MAX_LENGTH = 2000;
