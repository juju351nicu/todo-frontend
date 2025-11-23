<script setup="js">
import SideMenu from "@/components/SideMenu.vue";
import Loading from "@/components/Loading.vue";
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import jaLocale from '@fullcalendar/core/locales/ja'
import { useTodoStore } from "@/stores/todo";
import { onBeforeMount, reactive, ref } from 'vue'
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
/** ローディングフラグ */
const isLoading = ref(false);
/** モーダルを表示・非表示フラグ */
const isShowModal = ref(false);
const showMessageModal = () => {
  isShowModal.value = true;
};
/** 検索用タイトル */
const searchTitle = ref("");
/** 検索用完了・未完了フラグチェックボックス */
const selectedDoneFlag = ref(['0','1']);
/**
 * 検索ボタン押下の際、TODO情報を検索する。
 */
const formSubmit = ((event) => {
  // submitイベントの本来の動作を止める
  event.preventDefault();
  const payload = {
    "search_title": searchTitle.value,
    "date_range": "",
    "done_flag_values": selectedDoneFlag.value,
  };
  isLoading.value = true;
  try {
    todoStore.findCalendarList(payload).then(async (response) => {
      if (response.ok) {
        const data = await response.json();
        calendarOptions.events = data.todoList;
        isLoading.value = false;
      } else {
        const err = await response.json();
        if (!Util.isEmpty(err.fieldErrors)) {
          showMessageModal();
          err.fieldErrors.forEach((fieldError) => {
            errorMessages.value.push(fieldError.message);
          });
          isLoading.value = false;
        }
        throw new Error("There's an error upstream and it says");
      }
    })
  } catch (error) {
    console.log(error);
  };
});
/** 初期表示 */
onBeforeMount(() => {
  const payload = {
    "search_title": "",
    "date_range": "",
    "done_flag_values": [],
  };
  isLoading.value = true;
  try {
    todoStore.findCalendarList(payload).then(async (response) => {
      if (response.ok) {
        const data = await response.json();
        console.log(data);
        calendarOptions.events = data.todoList;
        // data.eventDtos.forEach((field) => {
        //   this.calendarOptions.events.push({ title: field.title, date: field.start },);
        // });
        isLoading.value = false;
      } else {
        const err = await response.json();
        if (!Util.isEmpty(err.fieldErrors)) {
          showMessageModal();
          err.fieldErrors.forEach((fieldError) => {
            errorMessages.value.push(fieldError.message);
          });
          isLoading.value = false;
        }
        throw new Error("There's an error upstream and it says");
      }
    })
  } catch (error) {
    console.log(error);
  };
});
</script>
<template>
  <SideMenu />
  <Loading v-if="isLoading" />
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
      <v-btn color="success" @click="formSubmit($event)">検索</v-btn>
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
