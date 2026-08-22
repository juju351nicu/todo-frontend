import type {
  TaskEffortPlan,
  TaskEffortPlanCreateRequest,
  TaskEffortPlanForm,
  TaskEffortPlanUpdateRequest,
  TaskWorkloadDateRange,
} from "@/features/wbs/types/wbs";
import {
  getToday,
  isValidIsoLocalDate,
} from "@/features/wbs/utils/effort";

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_WORKLOAD_DAYS = 366;

/** yyyy-MM-ddをUTC日付へ変換する。事前に形式・実在日検証を行うこと。 */
const parseIsoLocalDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

/** date inputへ渡す日付をブラウザーのローカル年月から組み立てる。 */
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** 初期workload検索期間としてブラウザー現在月の初日・末日を返す。 */
export const buildDefaultWorkloadDateRange = (): TaskWorkloadDateRange => {
  const now = new Date();
  return {
    dateFrom: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    dateTo: formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

/**
 * 新規登録または更新対象から、API Responseを変更しないDialog入力を作る。
 *
 * @param defaultAssigneeAccountId 新規登録時に初期選択する予定担当者ID
 * @param effortPlan 更新対象。新規登録の場合は省略する
 * @returns Dialogが保持する独立した入力値
 */
export const buildTaskEffortPlanForm = (
  defaultAssigneeAccountId: number | null,
  effortPlan?: Readonly<TaskEffortPlan> | null
): TaskEffortPlanForm => ({
  planDate: effortPlan?.planDate ?? getToday(),
  plannedEffortMinutes: effortPlan?.plannedEffortMinutes ?? null,
  assigneeAccountId:
    effortPlan?.assigneeAccountId ?? defaultAssigneeAccountId,
});

/**
 * Task日別予定フォームをBackendと同じ主要制約で検証する。
 * Project参加状態、Task種別、同一日重複、versionはBackendを最終判定とする。
 *
 * @param form Dialogから受け取った入力値
 * @param allowedAssigneeAccountIds 画面へ提示した有効Project member ID
 * @returns 利用者へ表示する検証メッセージ。問題がなければ空配列
 */
export const validateTaskEffortPlanForm = (
  form: Readonly<TaskEffortPlanForm>,
  allowedAssigneeAccountIds: ReadonlySet<number>
): string[] => {
  const messages: string[] = [];
  if (!isValidIsoLocalDate(form.planDate)) {
    messages.push("予定日を入力してください。");
  }
  if (
    form.plannedEffortMinutes === null ||
    !Number.isSafeInteger(form.plannedEffortMinutes) ||
    form.plannedEffortMinutes < 1 ||
    form.plannedEffortMinutes > 1440
  ) {
    messages.push("予定工数は1分以上1440分以下の整数で入力してください。");
  }
  if (
    form.assigneeAccountId === null ||
    !Number.isSafeInteger(form.assigneeAccountId) ||
    form.assigneeAccountId <= 0 ||
    !allowedAssigneeAccountIds.has(form.assigneeAccountId)
  ) {
    messages.push("Projectへ参加している予定担当者を選択してください。");
  }
  return messages;
};

/** 検証済みフォームをTask日別予定登録Requestへ変換する。 */
export const buildTaskEffortPlanCreateRequest = (
  form: Readonly<TaskEffortPlanForm>
): TaskEffortPlanCreateRequest => ({
  planDate: form.planDate,
  plannedEffortMinutes: form.plannedEffortMinutes as number,
  assigneeAccountId: form.assigneeAccountId as number,
});

/** 検証済みフォームと取得時点versionをTask日別予定更新Requestへ変換する。 */
export const buildTaskEffortPlanUpdateRequest = (
  form: Readonly<TaskEffortPlanForm>,
  version: number
): TaskEffortPlanUpdateRequest => ({
  ...buildTaskEffortPlanCreateRequest(form),
  version,
});

/**
 * workload検索期間をBackendと同じ最大366日で検証する。
 *
 * @param dateRange 検索開始日・終了日
 * @returns 利用者へ表示する検証メッセージ。問題がなければ空配列
 */
export const validateTaskWorkloadDateRange = (
  dateRange: Readonly<TaskWorkloadDateRange>
): string[] => {
  const messages: string[] = [];
  if (!isValidIsoLocalDate(dateRange.dateFrom)) {
    messages.push("集計開始日を入力してください。");
  }
  if (!isValidIsoLocalDate(dateRange.dateTo)) {
    messages.push("集計終了日を入力してください。");
  }
  if (messages.length > 0) {
    return messages;
  }
  const dateFrom = parseIsoLocalDate(dateRange.dateFrom);
  const dateTo = parseIsoLocalDate(dateRange.dateTo);
  if (dateTo.getTime() < dateFrom.getTime()) {
    return ["集計終了日は集計開始日以降にしてください。"];
  }
  const inclusiveDays =
    Math.floor((dateTo.getTime() - dateFrom.getTime()) / MILLIS_PER_DAY) + 1;
  return inclusiveDays > MAX_WORKLOAD_DAYS
    ? ["workloadの集計期間は366日以内にしてください。"]
    : [];
};
