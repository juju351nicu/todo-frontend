import type {
  TaskRecurrenceFrequency,
  TaskRecurrenceGenerationStatus,
  TaskRecurrenceStatus,
  TaskRecurrenceWeekday,
} from "@/features/task/types/taskRecurrence";
import type { TaskSelectOption } from "@/features/task/utils/taskFormOptions";
import type { SemanticColor } from "@/shared/types/color";

/** 繰り返し頻度の選択肢。 */
export const RECURRENCE_FREQUENCY_OPTIONS: readonly TaskSelectOption<TaskRecurrenceFrequency>[] = [
  { title: "日次", value: "DAILY" },
  { title: "週次", value: "WEEKLY" },
  { title: "月次", value: "MONTHLY" },
];

/** 週次の曜日選択肢。表示順は月曜始まり。 */
export const RECURRENCE_WEEKDAY_OPTIONS: readonly TaskSelectOption<TaskRecurrenceWeekday>[] = [
  { title: "月", value: "MONDAY" },
  { title: "火", value: "TUESDAY" },
  { title: "水", value: "WEDNESDAY" },
  { title: "木", value: "THURSDAY" },
  { title: "金", value: "FRIDAY" },
  { title: "土", value: "SATURDAY" },
  { title: "日", value: "SUNDAY" },
];

/** 規則編集時に利用者が切り替えられる状態。BLOCKED・ENDED・ARCHIVEDはBackendだけが設定する。 */
export const RECURRENCE_LIFECYCLE_OPTIONS = [
  { title: "有効", value: "ACTIVE" },
  { title: "一時停止", value: "PAUSED" },
] as const;

const STATUS_LABELS: Readonly<Record<TaskRecurrenceStatus, string>> = {
  ACTIVE: "有効",
  PAUSED: "一時停止",
  BLOCKED: "要修正",
  ENDED: "終了",
  ARCHIVED: "アーカイブ済み",
};

const STATUS_COLORS: Readonly<Record<TaskRecurrenceStatus, SemanticColor>> = {
  ACTIVE: "success",
  PAUSED: "warning",
  BLOCKED: "error",
  ENDED: "neutral",
  ARCHIVED: "neutral",
};

const GENERATION_STATUS_LABELS: Readonly<Record<TaskRecurrenceGenerationStatus, string>> = {
  PENDING: "待機中",
  PROCESSING: "処理中",
  RETRY_WAIT: "再試行待ち",
  SUCCEEDED: "成功",
  FAILED: "失敗",
  SKIPPED: "スキップ",
};

const GENERATION_STATUS_COLORS: Readonly<Record<TaskRecurrenceGenerationStatus, SemanticColor>> = {
  PENDING: "info",
  PROCESSING: "info",
  RETRY_WAIT: "warning",
  SUCCEEDED: "success",
  FAILED: "error",
  SKIPPED: "neutral",
};

/** BackendのBLOCKED理由・生成失敗の安定error codeに対応する運用者向け説明。 */
const BLOCKED_REASON_LABELS: Readonly<Record<string, string>> = {
  PROJECT_ARCHIVED: "Projectがアーカイブされています。",
  RULE_OWNER_INACTIVE: "規則の所有者が無効です。",
  RULE_OWNER_NOT_PROJECT_MEMBER: "規則の所有者がProjectに参加していません。",
  ASSIGNEE_NOT_PROJECT_MEMBER: "担当者がProjectに参加していません。",
  ASSIGNEE_ID_OUT_OF_RANGE: "担当者IDをTaskへ保存できません。",
  TASK_STATUS_UNAVAILABLE: "指定したBoard列を利用できません。",
  FEATURE_NOT_ENTITLED: "規則の所有者に繰り返しTaskの機能資格がありません。",
  TASK_POSITION_CONFLICT: "Taskの配置位置が競合しました。",
  RETRY_EXHAUSTED: "自動再試行の上限へ到達しました。",
};

/** 繰り返し規則の状態コードを表示名へ変換する。 */
export const getRecurrenceStatusLabel = (status: TaskRecurrenceStatus): string => STATUS_LABELS[status];

/** 繰り返し規則の状態コードを表示色へ変換する。 */
export const getRecurrenceStatusColor = (status: TaskRecurrenceStatus): SemanticColor => STATUS_COLORS[status];

/** 生成履歴の状態コードを表示名へ変換する。 */
export const getGenerationStatusLabel = (status: TaskRecurrenceGenerationStatus): string =>
  GENERATION_STATUS_LABELS[status];

/** 生成履歴の状態コードを表示色へ変換する。 */
export const getGenerationStatusColor = (status: TaskRecurrenceGenerationStatus): SemanticColor =>
  GENERATION_STATUS_COLORS[status];

/**
 * 頻度と間隔を一覧・詳細向けの短い日本語へ変換する。
 *
 * @param weekdays 週次の曜日。表示はRECURRENCE_WEEKDAY_OPTIONSの曜日名で、未知の値は省く
 * @param monthlyDay 月次の日付。未設定は`-`
 */
export const formatRecurrenceSchedule = (
  frequency: TaskRecurrenceFrequency,
  intervalCount: number,
  weekdays: readonly TaskRecurrenceWeekday[],
  monthlyDay: number | null,
): string => {
  if (frequency === "DAILY") {
    return `${intervalCount}日ごと`;
  }
  if (frequency === "MONTHLY") {
    return `${intervalCount}か月ごと・${monthlyDay ?? "-"}日`;
  }
  const labels = weekdays
    .map((weekday) => RECURRENCE_WEEKDAY_OPTIONS.find((option) => option.value === weekday)?.title)
    .filter((label): label is string => label !== undefined)
    .join("・");
  return `${intervalCount}週ごと・${labels}`;
};

/** ISO時刻を利用者のlocaleで読める日時へ変換する。未設定は`-`。 */
export const formatRecurrenceDateTime = (value: string | null): string => (value ? new Date(value).toLocaleString() : "-");

/** 安定error codeを運用者向け説明へ変換する。未知のcodeは隠さずそのまま表示し、未設定は`-`。 */
export const formatRecurrenceErrorCode = (value: string | null): string =>
  value ? (BLOCKED_REASON_LABELS[value] ?? value) : "-";
