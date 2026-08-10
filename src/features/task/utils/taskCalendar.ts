import type { CalendarOptions, EventInput } from "@fullcalendar/core";
import jaLocale from "@fullcalendar/core/locales/ja";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";

import type { TodoListItem } from "@/features/task/types/task";

/** Todo一覧APIのデータをFullCalendarのイベントへ変換する。 */
export const buildTodoCalendarEvents = (
  todoList: TodoListItem[]
): EventInput[] =>
  todoList.map((todo) => ({
    id: String(todo.todoId),
    title: todo.title,
    start: todo.start,
    end: todo.end,
    color: todo.color ?? undefined,
    url: todo.url ?? undefined,
    display: (todo.display ?? undefined) as EventInput["display"],
    extendedProps: {
      todoId: todo.todoId,
      description: todo.description,
      detail: todo.detail,
      doneFlag: todo.doneFlag,
      userId: todo.userId,
      remainingDays: todo.remainingDays,
      priority: todo.priority,
    },
  }));

/** Todoカレンダー画面のFullCalendar初期設定を生成する。 */
export const buildTodoCalendarOptions = (): CalendarOptions => ({
  locale: jaLocale,
  height: typeof window === "undefined" ? 700 : window.innerHeight - 100,
  plugins: [dayGridPlugin, interactionPlugin, timeGridPlugin],
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
  dateClick: (arg: DateClickArg) => {
    if (typeof window !== "undefined") {
      window.alert(`date click! ${arg.dateStr}`);
    }
  },
  events: [],
});
