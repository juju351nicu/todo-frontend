import {
  CHECKLIST_ITEM_MAX_COUNT,
  CHECKLIST_ITEM_MAX_LENGTH,
  TASK_DETAIL_MAX_LENGTH,
  TASK_DUE_OFFSET_MAX_DAYS,
  TASK_TITLE_MAX_LENGTH,
} from "@/features/task/constants/taskLimits";

/**
 * Task TemplateとTask繰り返し規則が持つ、生成するTaskの内容（snapshot）の入力。
 */
export interface TaskSnapshotInput {
  /** 生成するTaskの件名。 */
  title: string;
  /** 生成するTaskの詳細。 */
  detail: string;
  /** 生成するTaskの予定工数（分）。 */
  plannedEffortMinutes: number;
  /** 開始日から期限までの日数。 */
  dueOffsetDays: number;
  /** 生成するTaskのチェック項目の本文。 */
  checklistContents: readonly string[];
}

/**
 * TemplateとTask繰り返し規則に保存するTaskの内容を、Backendの入力制約に合わせて検証する。
 *
 * 件名 → 詳細 → 期限オフセット → 予定工数 → チェック項目の順に調べ、最初の誤りの文言だけを返す。
 * 件名・詳細・チェック項目はtrim後の長さで比べる（Backendもtrimしてから保存する）。
 * Template名・担当者・Board列のように画面ごとに違う項目は、呼出側がこの前後で調べる。
 *
 * @param snapshot 画面のフォームの値
 * @returns 最初に見つかった誤りの文言。誤りがなければ空文字
 */
export const validateTaskSnapshot = (snapshot: TaskSnapshotInput): string => {
  const title = snapshot.title.trim();
  const detail = snapshot.detail.trim();
  const checklistContents = snapshot.checklistContents.map((content) => content.trim());
  if (!title || title.length > TASK_TITLE_MAX_LENGTH) {
    return `Taskタイトルを1〜${TASK_TITLE_MAX_LENGTH}文字で入力してください。`;
  }
  if (!detail || detail.length > TASK_DETAIL_MAX_LENGTH) {
    return `Task詳細を1〜${TASK_DETAIL_MAX_LENGTH}文字で入力してください。`;
  }
  if (
    !Number.isInteger(snapshot.dueOffsetDays) ||
    snapshot.dueOffsetDays < 0 ||
    snapshot.dueOffsetDays > TASK_DUE_OFFSET_MAX_DAYS
  ) {
    return `期限オフセットを0〜${TASK_DUE_OFFSET_MAX_DAYS}日で入力してください。`;
  }
  if (!Number.isSafeInteger(snapshot.plannedEffortMinutes) || snapshot.plannedEffortMinutes < 0) {
    return "予定工数を0分以上の整数で入力してください。";
  }
  if (
    checklistContents.length > CHECKLIST_ITEM_MAX_COUNT ||
    checklistContents.some(
      (content) => content.length === 0 || content.length > CHECKLIST_ITEM_MAX_LENGTH
    )
  ) {
    return `チェック項目は1〜${CHECKLIST_ITEM_MAX_LENGTH}文字、最大${CHECKLIST_ITEM_MAX_COUNT}件で入力してください。`;
  }
  return "";
};
