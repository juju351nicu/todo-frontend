<template>
  <FullCalendar :options="calendarOptions" />
</template>
<script setup="js">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import jaLocale from '@fullcalendar/core/locales/ja'
import { useTodoStore } from "@/stores/todo";
import { onBeforeMount, reactive } from 'vue'
/** Todoストア情報 */
const todoStore = useTodoStore();
/** フルカレンダー設定情報 */
const calendarOptions = reactive({
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
  initialView: 'dayGridMonth',
  dateClick: (arg) => {
    alert('date click! ' + arg.dateStr);
  },
  events: [],
});
/** */
onBeforeMount(() => {
  todoStore.findCalendarList()
    .then((response) => {
      console.log(response.status);
      return response.json();
    })
    .then((data) => {
      console.log(data);
      calendarOptions.events = data.eventDtos;
      // data.eventDtos.forEach((field) => {
      //   this.calendarOptions.events.push({ title: field.title, date: field.start },);
      // });
    })
    .catch((error) => {
      console.log(error);
    });
});
</script>
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
