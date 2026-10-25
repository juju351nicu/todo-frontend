import { describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, reactive } from "vue";

import { useDialogForm } from "@/shared/composables/useDialogForm";

/** Componentのpropsに相当するreactive状態でcomposableを作る。 */
const setUp = (overrides = {}) => {
  const props = reactive({ open: false, isSaving: false, name: "初期値" });
  const onClose = vi.fn();
  const onSave = vi.fn();
  const scope = effectScope();
  const dialog = scope.run(() =>
    useDialogForm({
      initialForm: { name: "" },
      syncSources: [() => props.open],
      buildForm: () => (props.open ? { name: props.name } : undefined),
      isBusy: () => props.isSaving,
      canSubmit: (form) => form.name.trim().length > 0,
      onClose,
      onSave,
      ...overrides,
    })
  );
  return { dialog, onClose, onSave, props, scope };
};

describe("useDialogForm", () => {
  it("開いたときに親の確定値からフォームを作り、閉じている間は入力を保持する", async () => {
    const { dialog, props } = setUp();
    expect(dialog.form.value).toEqual({ name: "" });

    props.open = true;
    await nextTick();
    expect(dialog.form.value).toEqual({ name: "初期値" });

    dialog.form.value.name = "入力中";
    props.open = false;
    await nextTick();
    expect(dialog.form.value.name).toBe("入力中");
  });

  it("送信時は入力値の複製を渡し、送信後の入力変更が渡した値へ影響しない", async () => {
    const { dialog, onSave, props } = setUp();
    props.open = true;
    await nextTick();

    dialog.submitForm();
    dialog.form.value.name = "変更後";

    expect(onSave).toHaveBeenCalledWith({ name: "初期値" });
    expect(onSave.mock.calls[0][0]).not.toBe(dialog.form.value);
  });

  it("送信条件を満たさない、または処理中の場合は送信しない", async () => {
    const { dialog, onSave, props } = setUp();
    props.open = true;
    await nextTick();

    dialog.form.value.name = "  ";
    dialog.submitForm();
    dialog.form.value.name = "保存";
    props.isSaving = true;
    dialog.submitForm();

    expect(dialog.canSubmit.value).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("処理中は閉じる操作を無視し、処理後は閉じる操作だけを親へ通知する", () => {
    const { dialog, onClose, props } = setUp();

    props.isSaving = true;
    dialog.handleDialogVisibility(false);
    expect(onClose).not.toHaveBeenCalled();

    props.isSaving = false;
    dialog.handleDialogVisibility(true);
    expect(onClose).not.toHaveBeenCalled();
    dialog.handleDialogVisibility(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("フォームがnullの場合もnullのまま渡す", () => {
    const { dialog, onSave } = setUp({
      initialForm: null,
      buildForm: () => undefined,
      canSubmit: undefined,
    });

    dialog.submitForm();

    expect(onSave).toHaveBeenCalledWith(null);
  });
});
