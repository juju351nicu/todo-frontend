import type { CalendarOptions, EventInput } from "@fullcalendar/core";
import jaLocale from "@fullcalendar/core/locales/ja";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";

import type { TaskListItem } from "@/features/task-list/types/taskList";

/** Task一覧APIのデータをFullCalendarのイベントへ変換する。 */
export const buildTaskCalendarEvents = (taskList: TaskListItem[]): EventInput[] =>
  taskList.map((task) => ({
    id: String(task.taskId),
    title: task.title,
    start: task.start,
    end: task.end,
    color: task.color ?? undefined,
    url: task.url ?? undefined,
    display: (task.display ?? undefined) as EventInput["display"],
    extendedProps: {
      taskId: task.taskId,
      detail: task.detail,
      doneFlag: task.doneFlag,
      userId: task.userId,
      remainingDays: task.remainingDays,
      priority: task.priority,
    },
  }));

/** Taskカレンダー画面のFullCalendar初期設定を生成する。 */
export const buildTaskCalendarOptions = (): CalendarOptions => ({
  locale: jaLocale,
  height: typeof window === "undefined" ? 700 : window.innerHeight - 100,
  plugins: [dayGridPlugin, timeGridPlugin],
  headerToolbar: {
    left: "prev,next today",
    center: "title",
    right: "dayGridMonth,timeGridWeek,timeGridDay",
  },
  buttonText: {
    prev: "前月",
    next: "次月",
    today: "今日",
    month: "月",
    week: "週",
    day: "日",
    list: "リスト",
  },
  initialView: "dayGridMonth",
  events: [],
});
