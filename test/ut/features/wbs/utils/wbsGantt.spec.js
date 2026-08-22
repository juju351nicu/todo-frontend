import { describe, expect, it, vi } from "vitest";

import {
  addGanttRangePadding,
  buildWbsGanttData,
  buildWbsGanttLinks,
  buildWbsGanttTooltipText,
  configureWbsGantt,
} from "@/features/wbs/utils/wbsGantt";

/** Gantt変換の入力となる安全なWBS階層行を作る。 */
const buildRow = (overrides = {}) => ({
  taskId: 1,
  parentTaskId: null,
  taskType: "TASK",
  wbsCode: null,
  title: "Task",
  detail: "詳細",
  plannedStartDate: "2026-08-01",
  plannedEndDate: "2026-08-02",
  plannedEffortMinutes: 60,
  progressPercent: 25,
  actualStartDate: null,
  actualEndDate: null,
  assigneeAccountId: 1,
  priority: 2,
  taskStatusId: 1,
  taskStatusCode: "TODO",
  taskStatusName: "Todo",
  position: 1000,
  version: 0,
  depth: 0,
  hasChildren: false,
  ...overrides,
});

/** Gantt依存線の入力となるBackend Task依存関係を作る。 */
const buildDependency = (overrides = {}) => ({
  dependencyId: 101,
  predecessorTaskId: 1,
  successorTaskId: 2,
  dependencyType: "FINISH_TO_START",
  lagMinutes: 30,
  version: 0,
  ...overrides,
});

describe("WBS Gantt変換", () => {
  it("DHTMLXの拡張初期値に左右されず不正日付Taskをtimelineへ描画しない", () => {
    const instance = {
      config: { show_unscheduled: false },
      templates: {},
      plugins: vi.fn(),
    };

    configureWbsGantt(instance);

    expect(instance.config).toEqual(
      expect.objectContaining({
        readonly: true,
        show_links: true,
        show_unscheduled: true,
        drag_move: false,
        drag_progress: false,
        drag_resize: false,
        drag_links: false,
      })
    );
    expect(instance.plugins).toHaveBeenCalledWith({ tooltip: true });
    expect(instance.templates.tooltip_text).toBeTypeOf("function");
  });

  it("予定期間とnullableな実績期間をHTML escape済みtooltipへ変換する", () => {
    expect(
      buildWbsGanttTooltipText({
        text: "<設計&実装>",
        plannedStartDate: "2026-08-20",
        plannedEndDate: "2026-08-24",
        actualStartDate: "2026-08-22",
        actualEndDate: null,
      })
    ).toBe(
      "<strong>&lt;設計&amp;実装&gt;</strong><br>" +
        "予定: 2026-08-20 ～ 2026-08-24<br>" +
        "実績: 2026-08-22 ～ 作業中"
    );
  });

  it("表示中Task間のFinish-to-Startを編集不可の依存線へ変換する", () => {
    const links = buildWbsGanttLinks(
      [buildRow({ taskId: 1 }), buildRow({ taskId: 2 })],
      [buildDependency()]
    );

    expect(links).toEqual([
      {
        id: 101,
        source: 1,
        target: 2,
        type: "0",
        readonly: true,
      },
    ]);
    // DHTMLXのlagはGantt duration unitで解釈されるため、Backendの分値を誤変換しない。
    expect(links[0]).not.toHaveProperty("lag");
  });

  it("依存関係の片方がWBS表示対象にない場合は未解決の依存線を作らない", () => {
    const links = buildWbsGanttLinks(
      [buildRow({ taskId: 1 })],
      [buildDependency({ successorTaskId: 999 })]
    );

    expect(links).toEqual([]);
  });

  it("Task種別・進捗・表示期間をDHTMLXの読取り専用dataへ変換する", () => {
    const result = buildWbsGanttData([
      buildRow({
        taskId: 1,
        taskType: "SUMMARY",
        wbsCode: "1",
        title: "Phase 1",
        progressPercent: 120,
        hasChildren: true,
      }),
      buildRow({
        taskId: 2,
        parentTaskId: 1,
        taskType: "MILESTONE",
        title: "完了判定",
        plannedStartDate: "2026-08-05",
        plannedEndDate: "2026-08-05",
        progressPercent: -1,
        depth: 1,
      }),
    ]);

    expect(result.tasks).toEqual([
      expect.objectContaining({
        id: 1,
        text: "1 Phase 1",
        parent: 0,
        type: "project",
        start_date: "2026-08-01",
        end_date: "2026-08-03",
        plannedStartDate: "2026-08-01",
        plannedEndDate: "2026-08-02",
        actualStartDate: null,
        actualEndDate: null,
        progress: 1,
        readonly: true,
      }),
      expect.objectContaining({
        id: 2,
        parent: 1,
        type: "milestone",
        start_date: "2026-08-05",
        end_date: "2026-08-05",
        progress: 0,
      }),
    ]);
    expect(result.rangeStart).toEqual(new Date(2026, 7, 1));
    expect(result.rangeEnd).toEqual(new Date(2026, 7, 5));
  });

  it("Backendの親IDではなく安全な階層行のdepthから親子関係を再構成する", () => {
    const result = buildWbsGanttData([
      buildRow({ taskId: 10, parentTaskId: 20, depth: 0 }),
      buildRow({ taskId: 11, parentTaskId: 999, depth: 1 }),
      buildRow({ taskId: 12, parentTaskId: 11, depth: 2 }),
      buildRow({ taskId: 20, parentTaskId: 10, depth: 0 }),
    ]);

    expect(result.tasks.map(({ id, parent }) => [id, parent])).toEqual([
      [10, 0],
      [11, 10],
      [12, 11],
      [20, 0],
    ]);
  });

  it("不正日付をunscheduledとしてtreeへ残し有効日付だけで表示期間を作る", () => {
    const result = buildWbsGanttData([
      buildRow({
        taskId: 1,
        plannedStartDate: "2026-02-30",
        plannedEndDate: "2026-03-01",
      }),
      buildRow({
        taskId: 2,
        plannedStartDate: "2026-09-10",
        plannedEndDate: "2026-09-08",
      }),
      buildRow({
        taskId: 3,
        plannedStartDate: "2026-10-01",
        plannedEndDate: "2026-10-01",
      }),
    ]);

    expect(result.unscheduledTaskIds).toEqual([1, 2]);
    expect(result.tasks[0]).toEqual(
      expect.objectContaining({ id: 1, unscheduled: true })
    );
    expect(result.tasks[0].start_date).toBeUndefined();
    expect(result.rangeStart).toEqual(new Date(2026, 9, 1));
    expect(result.rangeEnd).toEqual(new Date(2026, 9, 2));
  });

  it("Gantt表示余白を月・年境界でもcalendar dayとして加算する", () => {
    expect(addGanttRangePadding(new Date(2026, 0, 1), -3)).toEqual(
      new Date(2025, 11, 29)
    );
    expect(addGanttRangePadding(new Date(2026, 11, 31), 7)).toEqual(
      new Date(2027, 0, 7)
    );
  });
});
