<template>
  <FullCalendar :options="calendarOptions" />
</template>
<script>
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import Const from "@/constants/const.js";
import Fetcher from "@/utils/rest.js";
export default {
  components: {
    FullCalendar // make the <FullCalendar> tag available
  },
  data() {
    return {
      calendarOptions: {
        plugins: [dayGridPlugin, interactionPlugin],
        initialView: 'dayGridMonth',
        dateClick: this.handleDateClick,
        events: [
        ],
      }
    }
  },
  methods: {
    handleDateClick: function (arg) {
      alert('date click! ' + arg.dateStr)
    }
  },
  mounted() {
    Fetcher.getRequest(Const.REST_PATH.TODO_CALENDAR)
      .then((response) => {
        console.log(response.status);
        return response.json();
      })
      .then((data) => {
        console.log(data);
        this.calendarOptions.events = data.eventDtos;
        // data.eventDtos.forEach((field) => {
        //   this.calendarOptions.events.push({ title: field.title, date: field.start },);
        // });
      })
      .catch((error) => {
        console.log(error);
      });
  }
}
</script>
<style scoped>
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
