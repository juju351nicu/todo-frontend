<script setup lang="ts">
import TheHeader from "@/components/TheHeader.vue";
import Loading from "@/components/Loading.vue";
import type { CalendarOptions, EventInput } from "@fullcalendar/core";
import jaLocale from "@fullcalendar/core/locales/ja";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import FullCalendar from "@fullcalendar/vue3";
import { onBeforeMount, reactive, ref } from "vue";

import { useTodoStore } from "@/features/task/stores/task";
import type { ErrorResponse } from "@/shared/types/error";
import type {
  TodoListItem,
  TodoListRequest,
  TodoListResponse,
} from "@/features/task/types/task";
import Util from "@/utils/util";

/** Todoストア情報 */
const todoStore = useTodoStore();

const toCalendarEvents = (todoList: TodoListItem[]): EventInput[] =>
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

/** フルカレンダー設定情報 */
const calendarOptions = reactive<CalendarOptions>({
  locale: jaLocale, // 日本語化
  height: window.innerHeight - 100,
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
    window.alert(`date click! ${arg.dateStr}`);
  },
  events: [] as EventInput[],
});
/** ローディングフラグ */
const isLoading = ref<boolean>(false);
/** エラーメッセージ */
const errorMessages = ref<string[]>([]);
/** 検索用タイトル */
const searchTitle = ref<string>("");
/** 検索用完了・未完了フラグチェックボックス */
const selectedDoneFlag = ref<string[]>(["0", "1"]);

const createSearchRequest = (): TodoListRequest => ({
  search_title: searchTitle.value,
  date_range: "",
  done_flag_values: Util.getNumberList(selectedDoneFlag.value),
});

const setResponseErrors = (errorResponse: ErrorResponse): void => {
  errorMessages.value = (errorResponse.fieldErrors ?? []).map(
    (fieldError) => fieldError.message
  );
  if (errorMessages.value.length === 0) {
    errorMessages.value = ["Todoカレンダーを取得できませんでした。"];
  }
};

const loadCalendar = async (payload: TodoListRequest): Promise<void> => {
  isLoading.value = true;
  errorMessages.value = [];
  try {
    const response = await todoStore.findCalendarList(payload);
    if (!response.ok) {
      setResponseErrors((await response.json()) as ErrorResponse);
      return;
    }
    const data = (await response.json()) as TodoListResponse;
    calendarOptions.events = toCalendarEvents(data.todoList);
  } catch (error: unknown) {
    console.error(error);
    if (errorMessages.value.length === 0) {
      errorMessages.value = ["Backendへ接続できませんでした。"];
    }
  } finally {
    isLoading.value = false;
  }
};

/**
 * 検索ボタン押下の際、TODO情報を検索する。
 */
const formSubmit = async (): Promise<void> => {
  await loadCalendar(createSearchRequest());
};
/** 初期表示 */
onBeforeMount(() => {
  void loadCalendar(createSearchRequest());
});
</script>
<template>
  <TheHeader />
  <Loading v-if="isLoading" />
  <v-alert v-if="errorMessages.length" type="error" class="mb-4">
    <div v-for="message in errorMessages" :key="message">{{ message }}</div>
  </v-alert>
  <v-card class="mx-auto" max-width="1000">
    <v-card-item>
      <v-card-title>
        Todo検索
        <v-row>
          <v-col>
            <v-text-field v-model="searchTitle" color="purple darken-2" placeholder="タイトル">
            </v-text-field>
          </v-col>
          <!--  <v-col>
                        <input type="text" name="date_from" placeholder="日付(date_from)" />
                        <input type="text" name="date_to" placeholder="日付(date_to)" />
                    </v-col> -->
          <v-col>
            <v-checkbox v-model="selectedDoneFlag" value="0" label="未完了のみ">
            </v-checkbox>
          </v-col>
          <v-col>
            <v-checkbox v-model="selectedDoneFlag" value="1" label="完了のみ">
            </v-checkbox>
          </v-col>
        </v-row>
      </v-card-title>
      <v-card-subtitle style="text-align: right">
        11月8日
      </v-card-subtitle>
    </v-card-item>
    <v-card-text style="text-align: right">
      <v-btn color="success" @click="formSubmit">検索</v-btn>
    </v-card-text>
  </v-card>
  <br />
  <FullCalendar :options="calendarOptions" />
</template>
<style>
th.fc-day-sat {
  background-color: #eaf4ff;
  /* 土曜日は青色に */
}

th.fc-day-sun {
  background-color: #ffeaea;
  /* 日曜日は赤色に */
}

td.fc-day-sat {
  background-color: #eaf4ff;
  /* 土曜日は青色に */
}

td.fc-day-sun {
  background-color: #ffeaea;
  /* 日曜日は赤色に */
}
</style>
