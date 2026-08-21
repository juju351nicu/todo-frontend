import type {
  TaskWorkLog,
  TaskWorkLogCreateRequest,
  TaskWorkLogForm,
  TaskWorkLogUpdateRequest,
} from "@/features/wbs/types/wbs";

const ISO_LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** yyyy-MM-ddとして存在する日付かをtimezoneに依存せず検査する。 */
const isValidIsoLocalDate = (value: string): boolean => {
  if (!ISO_LOCAL_DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
};

/** ブラウザーのローカル日付をdate input用のyyyy-MM-ddへ変換する。 */
const getToday = (): string => {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

/**
 * 新規登録または更新対象から、API Responseを変更しないDialog入力を作る。
 *
 * @param defaultWorkerAccountId 新規登録時に初期選択する作業者ID
 * @param workLog 更新対象。新規登録の場合は省略する
 * @returns Dialogが保持する独立した入力値
 */
export const buildTaskWorkLogForm = (
  defaultWorkerAccountId: number | null,
  workLog?: Readonly<TaskWorkLog> | null
): TaskWorkLogForm => ({
  workDate: workLog?.workDate ?? getToday(),
  actualEffortMinutes: workLog?.actualEffortMinutes ?? null,
  workerAccountId: workLog?.workerAccountId ?? defaultWorkerAccountId,
});

/**
 * Task日別実績フォームをBackendと同じ主要制約で検証する。
 * Project参加状態、Task種別、同一日重複、versionはBackendを最終判定とする。
 *
 * @param form Dialogから受け取った入力値
 * @param allowedWorkerAccountIds 画面へ提示した有効Project member ID
 * @returns 利用者へ表示する検証メッセージ。問題がなければ空配列
 */
export const validateTaskWorkLogForm = (
  form: Readonly<TaskWorkLogForm>,
  allowedWorkerAccountIds: ReadonlySet<number>
): string[] => {
  const messages: string[] = [];
  if (!isValidIsoLocalDate(form.workDate)) {
    messages.push("業務日を入力してください。");
  }
  if (
    form.actualEffortMinutes === null ||
    !Number.isSafeInteger(form.actualEffortMinutes) ||
    form.actualEffortMinutes < 1 ||
    form.actualEffortMinutes > 1440
  ) {
    messages.push("実績工数は1分以上1440分以下の整数で入力してください。");
  }
  if (
    form.workerAccountId === null ||
    !Number.isSafeInteger(form.workerAccountId) ||
    form.workerAccountId <= 0 ||
    !allowedWorkerAccountIds.has(form.workerAccountId)
  ) {
    messages.push("Projectへ参加している作業者を選択してください。");
  }
  return messages;
};

/** 検証済みフォームをTask日別実績登録Requestへ変換する。 */
export const buildTaskWorkLogCreateRequest = (
  form: Readonly<TaskWorkLogForm>
): TaskWorkLogCreateRequest => ({
  workDate: form.workDate,
  actualEffortMinutes: form.actualEffortMinutes as number,
  workerAccountId: form.workerAccountId as number,
});

/** 検証済みフォームと取得時点versionをTask日別実績更新Requestへ変換する。 */
export const buildTaskWorkLogUpdateRequest = (
  form: Readonly<TaskWorkLogForm>,
  version: number
): TaskWorkLogUpdateRequest => ({
  ...buildTaskWorkLogCreateRequest(form),
  version,
});

/** 分単位工数を0分、分だけ、時間と分のいずれかへ整形する。 */
export const formatTaskWorkLogEffort = (minutes: number): string => {
  const normalizedMinutes = Number.isSafeInteger(minutes) && minutes > 0
    ? minutes
    : 0;
  const hours = Math.floor(normalizedMinutes / 60);
  const remainingMinutes = normalizedMinutes % 60;
  if (hours === 0) {
    return `${remainingMinutes}分`;
  }
  return remainingMinutes === 0
    ? `${hours}時間`
    : `${hours}時間${remainingMinutes}分`;
};
