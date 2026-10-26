import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";

import {
  DEFAULT_AVAILABLE_MINUTES,
  useWorkingDayEditForm,
} from "@/features/wbs/composables/useWorkingDayEditForm";

/** Project共通例外（休日・0分）が保存済みで、個人例外はない日。 */
const day = {
  workDate: "2026-08-22",
  dayType: "HOLIDAY",
  availableMinutes: 0,
  source: "PROJECT_OVERRIDE",
  projectOverride: { workDate: "2026-08-22", dayType: "HOLIDAY", availableMinutes: 0, version: 1 },
  memberOverride: null,
};
const projectTarget = { kind: "PROJECT", accountId: null };
const memberTarget = { kind: "MEMBER", accountId: 5 };

/**
 * テスト用の`useWorkingDayEditForm`を作る。propsはrefで持ち、getter経由で渡す（componentと同じ渡し方）。
 *
 * @param target 例外の対象
 */
const setup = (target = projectTarget) => {
  const open = ref(true);
  const targetRef = ref(target);
  const onClose = vi.fn();
  const onSave = vi.fn();
  const form = useWorkingDayEditForm({
    open: () => open.value,
    day: () => day,
    target: () => targetRef.value,
    isSaving: () => false,
    onClose,
    onSave,
  });
  return { form, open, targetRef, onClose, onSave };
};

describe("useWorkingDayEditForm", () => {
  it("保存済みのProject共通例外があれば編集として、その値でFormを作る", () => {
    const { form } = setup();

    expect(form.dialogTitle.value).toBe("稼働日例外を編集");
    expect(form.targetLabel.value).toBe("Project共通例外");
    expect(form.form.value).toEqual({ workDate: "2026-08-22", dayType: "HOLIDAY", availableMinutes: 0 });
  });

  it("個人例外がなければ登録として、有効値でFormを作り、対象のアカウントIDを示す", () => {
    const { form } = setup(memberTarget);

    expect(form.dialogTitle.value).toBe("稼働日例外を登録");
    expect(form.targetLabel.value).toBe("個人例外（アカウントID: 5）");
  });

  it("休日から稼働日へ切り替えたら既定の480分、稼働日から休日へ切り替えたら0分へ補正する", async () => {
    const { form } = setup();

    form.form.value.dayType = "WORKING_DAY";
    await nextTick();
    expect(form.form.value.availableMinutes).toBe(DEFAULT_AVAILABLE_MINUTES);

    form.form.value.availableMinutes = 300;
    form.form.value.dayType = "HOLIDAY";
    await nextTick();
    expect(form.form.value.availableMinutes).toBe(0);
  });

  it("稼働日のまま分数を変えても、0分でなければ入力値を保つ", async () => {
    const { form } = setup(memberTarget);
    form.form.value.dayType = "WORKING_DAY";
    form.form.value.availableMinutes = 300;
    await nextTick();

    form.form.value.dayType = "WORKING_DAY";
    await nextTick();

    expect(form.form.value.availableMinutes).toBe(300);
  });

  it("保存と閉じる操作を親のcallbackへ渡す", () => {
    const { form, onClose, onSave } = setup();

    form.submitForm();
    expect(onSave).toHaveBeenCalledWith({ workDate: "2026-08-22", dayType: "HOLIDAY", availableMinutes: 0 });
    form.closeDialog();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
