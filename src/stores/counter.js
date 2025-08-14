import { defineStore } from 'pinia';

export const useCounterStore = defineStore('counter', {
  state: () => ({
    count: 5,
  }),
  actions: {
    increment() {
      this.count++;
    },
  },
  getters: {
    doubleCount() {
      return this.count * 2;
    },
  },
  // SessionStorageに保存する場合
  persist: {
    storage: sessionStorage,
  },
});
