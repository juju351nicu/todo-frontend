import { ref, watch } from "vue";
import type { Ref } from "vue";

/**
 * 親が確定した値を、利用者が編集できる下書きとして保持する。
 *
 * 親の値が変わる（初期表示、再取得、競合回復など）たびに下書きを親の値で置き換える。下書きの編集は親へ自動では反映せず、
 * 呼出側が検索・取得の要求として明示的に渡す。オブジェクトは`clone`で複製し、下書きの編集が親の値を書き換えないようにする。
 *
 * @param source 親が確定した値を返すgetter。オブジェクトの場合は中身の変化も検知する
 * @param clone 値を下書き用に複製する関数。省略時はそのまま使う（文字列・数値向け）
 */
export const useSyncedDraft = <T>(source: () => T, clone: (value: T) => T = (value) => value): Ref<T> => {
  const draft = ref(clone(source())) as Ref<T>;
  watch(
    source,
    (value) => {
      draft.value = clone(value);
    },
    { deep: true },
  );
  return draft;
};
