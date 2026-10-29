import { computed, ref, toValue, watch } from "vue";
import type { MaybeRefOrGetter, Ref, WatchSource } from "vue";

/** `useDialogForm`の設定。 */
export interface DialogFormOptions<TForm> {
  /** 初期値。最初の同期までの値として使う。 */
  initialForm: TForm;
  /** 値が変わるたびにフォームを作り直すきっかけ（Dialogの開閉、編集対象、保存後の再取得結果など）。 */
  syncSources: WatchSource[];
  /**
   * 親が確定した値から入力フォームを作る。`undefined`を返した場合は入力中の値を保持する
   * （Dialogを閉じている間に再取得結果が届いた場合など）。
   */
  buildForm: () => TForm | undefined;
  /** 保存・削除中などでDialogを閉じたり再送信したりできない場合はtrue。 */
  isBusy: MaybeRefOrGetter<boolean>;
  /** 入力内容と親の状態から送信できるかを判定する。省略時は常に送信できる。 */
  canSubmit?: (form: TForm) => boolean;
  /** 未確定入力を破棄してDialogを閉じるよう親へ通知する。 */
  onClose: () => void;
  /** 入力値の複製を、検証とAPI送信を担当する親へ渡す。 */
  onSave: (form: TForm) => void;
}

/**
 * 親composableが状態を所有する入力Dialogで、フォームの同期・閉じる操作・送信を共通化する。
 *
 * - フォームは`syncSources`の変化ごとに`buildForm`で親の確定値から作り直し、親の状態を直接書き換えない。
 * - `isBusy`の間は閉じる操作と送信を無視し、処理中の入力破棄や二重送信を防ぐ。
 * - 送信時はフォームを浅く複製して渡す。配列等の入れ子を変更する場合は`onSave`側で複製すること。
 */
export const useDialogForm = <TForm>(options: DialogFormOptions<TForm>) => {
  const form = ref(options.initialForm) as Ref<TForm>;

  watch(
    options.syncSources,
    () => {
      const nextForm = options.buildForm();
      if (nextForm !== undefined) {
        form.value = nextForm;
      }
    },
    { immediate: true }
  );

  /** 送信できる場合はtrue。処理中は常にfalse。 */
  const canSubmit = computed<boolean>(
    () => !toValue(options.isBusy) && (options.canSubmit?.(form.value) ?? true)
  );

  /** 処理中でなければ、未確定入力を破棄してDialogを閉じるよう親へ通知する。 */
  const closeDialog = (): void => {
    if (!toValue(options.isBusy)) {
      options.onClose();
    }
  };

  /** Dialogが外側クリックやEscで閉じられようとした場合だけ通常のclose処理へ渡す。 */
  const handleDialogVisibility = (open: boolean): void => {
    if (!open) {
      closeDialog();
    }
  };

  /** 送信できる場合だけ、入力値の複製を親へ渡す。 */
  const submitForm = (): void => {
    if (canSubmit.value) {
      const value = form.value;
      options.onSave((value !== null && typeof value === "object" ? { ...value } : value) as TForm);
    }
  };

  return { canSubmit, closeDialog, form, handleDialogVisibility, submitForm };
};
