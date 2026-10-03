import type {
  TaskTimeSessionStatus,
  TaskWorkLogAuditAction,
} from "@/features/time-tracking/types/timeTracking";

const JST_TIME_ZONE = "Asia/Tokyo";

/**
 * Backend取得時点の経過秒へ、受信後にブラウザーで経過した秒数を加える。
 * 負値や時計の巻戻りは表示上0へ丸め、Backendの確定時刻や実績値は変更しない。
 */
export const calculateDisplayedElapsedSeconds = (
  backendElapsedSeconds: number,
  receivedAtMilliseconds: number,
  nowMilliseconds: number
): number =>
  Math.max(
    0,
    Math.trunc(backendElapsedSeconds) +
      Math.max(
        0,
        Math.floor((nowMilliseconds - receivedAtMilliseconds) / 1000)
      )
  );

/** 経過秒数を24時間を超えても桁を失わないHH:mm:ss形式へ変換する。 */
export const formatElapsedSeconds = (elapsedSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.trunc(elapsedSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

/** 分数を0分、1時間、1時間30分の日本語表示へ変換する。 */
export const formatEffortMinutes = (minutes: number): string => {
  const safeMinutes = Math.max(0, Math.trunc(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (hours === 0) {
    return `${remainingMinutes}分`;
  }
  return remainingMinutes === 0
    ? `${hours}時間`
    : `${hours}時間${remainingMinutes}分`;
};

/** ISO日時を日本語のAsia/Tokyo日時へ変換する。解釈不能値は元の文字列を返す。 */
export const formatJstDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

/** DateをAsia/Tokyoのyyyy-MM-dd形式へ変換する。 */
export const formatJstDate = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
};

/** 現在日まで30日間を初期表示するTimer履歴の検索期間を作る。 */
export const buildDefaultTimerHistoryRange = (
  now = new Date()
): { dateFrom: string; dateTo: string } => {
  const from = new Date(now.getTime());
  from.setUTCDate(from.getUTCDate() - 29);
  return { dateFrom: formatJstDate(from), dateTo: formatJstDate(now) };
};

/** Timer Session状態コードを利用者向け表示へ変換する。 */
export const getTimerSessionStatusLabel = (
  status: TaskTimeSessionStatus
): string =>
  ({ RUNNING: "計測中", STOPPED: "停止済み", CANCELED: "取消済み" })[
    status
  ];

/** 工数監査の操作コードを利用者向け表示へ変換する。 */
export const getWorkLogAuditActionLabel = (
  action: TaskWorkLogAuditAction
): string =>
  ({
    MANUAL_CREATE: "手入力登録",
    MANUAL_UPDATE: "手入力更新",
    MANUAL_DELETE: "手入力削除",
    TIMER_APPLY: "Timer反映",
  })[action];
