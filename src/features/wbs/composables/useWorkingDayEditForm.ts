import { computed, watch } from "vue";

import type { WorkingCalendarDay, WorkingCalendarTarget, WorkingDayForm } from "@/features/wbs/types/wbs";
import { buildWorkingDayForm, getWorkingDayOverride } from "@/features/wbs/utils/workingCalendar";
import { useDialogForm } from "@/shared/composables/useDialogForm";

/** 稼働日の既定の稼働可能時間（分）。休日から稼働日へ切り替えたときの初期値にも使う。 */
export const DEFAULT_AVAILABLE_MINUTES = 480;

/** 稼働日種別のselect候補。Backendの`dayType`と同じ値を持つ。 */
export const DAY_TYPE_OPTIONS = [
  { title: "稼働日", value: "WORKING_DAY" },
  { title: "休日", value: "HOLIDAY" },
] as const;

/** `useWorkingDayEditForm`へ稼働日例外Dialogのpropsとemitを渡すための入力。propsはgetterで渡す。 */
export interface UseWorkingDayEditFormOptions {
  /** Dialogを開いているか。開くたびにFormを確定値から作り直す。 */
  readonly open: () => boolean;
  /** 編集対象の日。未選択ならnull。 */
  readonly day: () => WorkingCalendarDay | null;
  /** 例外の対象（Project共通または個人）。未選択ならnull。 */
  readonly target: () => WorkingCalendarTarget | null;
  /** 個人例外の対象の参加者名。不明ならnull（アカウントIDで示す）。 */
  readonly targetDisplayName: () => string | null;
  /** 保存中か。保存中はDialogを閉じさせない。 */
  readonly isSaving: () => boolean;
  /** Dialogを閉じる操作を親へ知らせる。 */
  readonly onClose: () => void;
  /** 入力したFormの保存を親へ依頼する。検証とAPI呼び出しは親が行う。 */
  readonly onSave: (form: WorkingDayForm) => void;
}

/** 入力のないForm。Dialogを閉じている間や、対象日・対象が未選択のときに使う。 */
const createEmptyForm = (): WorkingDayForm => ({
  workDate: "",
  dayType: "WORKING_DAY",
  availableMinutes: DEFAULT_AVAILABLE_MINUTES,
});

/**
 * 稼働日例外の登録・編集Dialog（`WorkingDayEditDialog.vue`）のForm状態と表示文言を管理する。
 *
 * - Dialogを開く、対象日を変える、競合で再取得するたびに、Backendの確定値からFormを作り直す。
 * - 稼働日種別を切り替えたら、Backendの制約（休日は0分、稼働日は1分以上）を満たす標準値へ補正する。
 * - 保存はemitで親composable（`useWbsWorkingCalendar`）へ委ね、ここではAPIを呼ばない。
 *
 * @param options propsのgetterとemitのcallback
 * @returns Form、表示文言、Dialog操作
 */
export const useWorkingDayEditForm = (options: UseWorkingDayEditFormOptions) => {
  /** 選択日に既に保存されている例外。新規登録ならnull。 */
  const editingOverride = computed(() => {
    const day = options.day();
    const target = options.target();
    return day !== null && target !== null ? getWorkingDayOverride(day, target) : null;
  });
  const dialogTitle = computed(() => (editingOverride.value === null ? "稼働日例外を登録" : "稼働日例外を編集"));
  /** Dialogの説明に出す例外の対象。個人例外なら参加者名（不明ならアカウントID）を示す。 */
  const targetLabel = computed(() => {
    const target = options.target();
    if (target?.kind !== "MEMBER") {
      return "Project共通例外";
    }
    return `個人例外（${options.targetDisplayName() ?? `アカウントID: ${target.accountId}`}）`;
  });

  const { closeDialog, form, handleDialogVisibility, submitForm } = useDialogForm({
    initialForm: createEmptyForm(),
    syncSources: [options.open, options.day, options.target],
    buildForm: () => {
      const day = options.day();
      const target = options.target();
      return options.open() && day !== null && target !== null ? buildWorkingDayForm(day, target) : createEmptyForm();
    },
    isBusy: options.isSaving,
    canSubmit: () => options.day() !== null && options.target() !== null,
    onClose: options.onClose,
    onSave: options.onSave,
  });

  // 種別切替時にBackend制約（休日は0分、稼働日は1分以上）を満たす標準値へ補正し、入力の手戻りを減らす。
  watch(
    () => form.value.dayType,
    (dayType) => {
      if (dayType === "HOLIDAY") {
        form.value.availableMinutes = 0;
      } else if (form.value.availableMinutes === 0) {
        form.value.availableMinutes = DEFAULT_AVAILABLE_MINUTES;
      }
    },
  );

  return { closeDialog, dialogTitle, editingOverride, form, handleDialogVisibility, submitForm, targetLabel };
};
