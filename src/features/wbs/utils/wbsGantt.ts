import type {
  WbsGanttData,
  WbsGanttTask,
  WbsTaskType,
  WbsTreeRow,
} from "@/features/wbs/types/wbs";
import { normalizeProgressPercent } from "@/features/wbs/utils/wbsTree";

const ISO_LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const GANTT_ROOT_ID = 0;

/** yyyy-MM-ddをtimezone変換しないlocal dateとして検証・変換する。 */
const parseIsoLocalDate = (value: string): Date | null => {
  const matched = ISO_LOCAL_DATE_PATTERN.exec(value);
  if (matched === null) {
    return null;
  }
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
};

/** local dateをtimezoneに依存しないyyyy-MM-ddへ戻す。 */
const formatIsoLocalDate = (date: Date): string => {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** 表示上の終了日を含めるため、DHTMLXが使う排他的な終了境界へ1日加算する。 */
const addOneDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

/** BackendのTask種別をDHTMLX GanttのTask種別へ対応付ける。 */
const toGanttTaskType = (
  taskType: WbsTaskType
): WbsGanttTask["type"] =>
  (
    {
      TASK: "task",
      SUMMARY: "project",
      MILESTONE: "milestone",
    } as const
  )[taskType];

/** WBSコードがある場合だけGanttのTask名へ前置する。 */
const buildTaskText = (row: WbsTreeRow): string =>
  row.wbsCode === null || row.wbsCode.trim() === ""
    ? row.title
    : `${row.wbsCode} ${row.title}`;

/** 予定期間の最小開始日・最大終了境界を更新する。 */
const updateDateRange = (
  current: { start: Date | null; end: Date | null },
  start: Date,
  end: Date
): void => {
  if (current.start === null || start.getTime() < current.start.getTime()) {
    current.start = start;
  }
  if (current.end === null || end.getTime() > current.end.getTime()) {
    current.end = end;
  }
};

/**
 * 階層表と同じpreorder行を、読取り専用DHTMLX Gantt dataへ変換する。
 * 親IDはdepthから再構成し、Backend dataに循環があってもGantt内部へ循環を渡さない。
 *
 * @param rows buildWbsTreeRowsで安全に階層化したWBS行
 * @returns Gantt Task、日付不正Task、全体表示期間
 */
export const buildWbsGanttData = (
  rows: readonly WbsTreeRow[]
): WbsGanttData => {
  const ancestorIds: number[] = [];
  const unscheduledTaskIds: number[] = [];
  const range: { start: Date | null; end: Date | null } = {
    start: null,
    end: null,
  };

  const tasks = rows.map((row): WbsGanttTask => {
    const parent =
      row.depth > 0 ? ancestorIds[row.depth - 1] ?? GANTT_ROOT_ID : GANTT_ROOT_ID;
    ancestorIds[row.depth] = row.taskId;
    ancestorIds.length = row.depth + 1;

    const task: WbsGanttTask = {
      id: row.taskId,
      text: buildTaskText(row),
      parent,
      type: toGanttTaskType(row.taskType),
      progress: normalizeProgressPercent(row.progressPercent) / 100,
      open: true,
      readonly: true,
    };
    const start = parseIsoLocalDate(row.plannedStartDate);
    const plannedEnd = parseIsoLocalDate(row.plannedEndDate);
    if (
      start === null ||
      plannedEnd === null ||
      plannedEnd.getTime() < start.getTime()
    ) {
      task.unscheduled = true;
      unscheduledTaskIds.push(row.taskId);
      return task;
    }

    const endBoundary =
      row.taskType === "MILESTONE" ? start : addOneDay(plannedEnd);
    task.start_date = formatIsoLocalDate(start);
    task.end_date = formatIsoLocalDate(endBoundary);
    updateDateRange(range, start, endBoundary);
    return task;
  });

  return {
    tasks,
    unscheduledTaskIds,
    rangeStart: range.start,
    rangeEnd: range.end,
  };
};

/** 表示期間の前後へ余白日を追加し、先頭・末尾のTask barを確認しやすくする。 */
export const addGanttRangePadding = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
