import { describe, expect, it, vi } from "vitest";

import {
  buildTaskWorkLogCreateRequest,
  buildTaskWorkLogForm,
  buildTaskWorkLogUpdateRequest,
  formatTaskWorkLogEffort,
  validateTaskWorkLogForm,
} from "@/features/wbs/utils/taskWorkLog";

describe("Task日別実績工数Form", () => {
  it("取得済み実績からResponseを変更しない編集Formを作る", () => {
    const workLog = {
      workLogId: 41,
      taskId: 11,
      workDate: "2026-08-22",
      actualEffortMinutes: 480,
      workerAccountId: 2,
      workerDisplayName: "作業者",
      createdBy: 2,
      createdAt: "2026-08-22T01:00:00Z",
      updatedBy: 2,
      updatedAt: "2026-08-22T01:00:00Z",
      version: 3,
    };

    const form = buildTaskWorkLogForm(9, workLog);
    form.actualEffortMinutes = 510;

    expect(form).toEqual({
      workDate: "2026-08-22",
      actualEffortMinutes: 510,
      workerAccountId: 2,
    });
    expect(workLog.actualEffortMinutes).toBe(480);
  });

  it("新規Formへローカル当日と指定作業者を設定する", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T03:00:00+09:00"));

    expect(buildTaskWorkLogForm(2)).toEqual({
      workDate: "2026-08-22",
      actualEffortMinutes: null,
      workerAccountId: 2,
    });

    vi.useRealTimers();
  });

  it("存在しない日・値域外工数・候補外作業者をまとめて拒否する", () => {
    expect(
      validateTaskWorkLogForm(
        {
          workDate: "2026-02-30",
          actualEffortMinutes: 1441,
          workerAccountId: 9,
        },
        new Set([2, 3])
      )
    ).toEqual([
      "業務日を入力してください。",
      "実績工数は1分以上1440分以下の整数で入力してください。",
      "Projectへ参加している作業者を選択してください。",
    ]);
  });

  it("検証済みFormを登録Requestとversion付き更新Requestへ変換する", () => {
    const form = {
      workDate: "2026-08-22",
      actualEffortMinutes: 480,
      workerAccountId: 2,
    };

    expect(buildTaskWorkLogCreateRequest(form)).toEqual(form);
    expect(buildTaskWorkLogUpdateRequest(form, 3)).toEqual({
      ...form,
      version: 3,
    });
  });

  it("分単位工数を利用者向けの時間・分表示へ変換する", () => {
    expect(formatTaskWorkLogEffort(0)).toBe("0分");
    expect(formatTaskWorkLogEffort(45)).toBe("45分");
    expect(formatTaskWorkLogEffort(120)).toBe("2時間");
    expect(formatTaskWorkLogEffort(150)).toBe("2時間30分");
  });
});
