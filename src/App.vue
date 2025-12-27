<script>
import { useCounterStore } from "./stores/counter";
export default {
  name: "App",
  setup() {
    //インポートした関数を呼び出してストアをインスタンス化して変数に代入
    const store = useCounterStore(); //setup() 内で useXxxxStore() を実行
    return {
      //テンプレートで使用するストアのインスタンス全体を返すことができます
      store,
    };
  },
  components: {},
  methods: {},
};
</script>
<template>
  <v-app>
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>
<style scoped>
[v-cloak] {
  display: none;
}
</style>
