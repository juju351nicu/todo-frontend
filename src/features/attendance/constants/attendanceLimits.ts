/**
 * 勤怠（修正申請・月次と修正申請の審査）の入力の上限。
 *
 * BackendのRequest DTO（`AttendanceCorrectionCreateRequest`・審査と差戻しのRequest）の`@Size`と同じ値にする。
 * 画面の検証・`maxlength`・`FieldCounter`はこの定数を使う。
 */

/** 修正申請の理由・備考、審査コメント、差戻し理由の最大文字数。 */
export const ATTENDANCE_TEXT_MAX_LENGTH = 1000;

/** 修正申請の勤務区間の最大件数。1つの勤務区間に置ける休憩区間の最大件数も同じ値。 */
export const ATTENDANCE_CORRECTION_PERIOD_MAX_COUNT = 20;
