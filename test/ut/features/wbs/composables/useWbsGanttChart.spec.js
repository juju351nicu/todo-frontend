import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";

const mocks = vi.hoisted(() => ({
  instance: null,
  mountedHooks: [],
  unmountHooks: [],
}));

vi.mock("vue", async () => {
  const actual = await vi.importActual("vue");
  return {
    ...actual,
    onMounted: (hook) => mocks.mountedHooks.push(hook),
    onBeforeUnmount: (hook) => mocks.unmountHooks.push(hook),
  };
});

vi.mock("dhtmlx-gantt", () => ({
  Gantt: { getGanttInstance: () => mocks.instance },
}));

vi.mock("@/features/wbs/utils/wbsGantt", () => ({
  addGanttRangePadding: (date, days) => `${date}${days > 0 ? "+" : ""}${days}`,
  buildWbsGanttData: (rows) => ({
    tasks: rows.map((row) => ({ id: row.taskId })),
    rangeStart: rows.length ? "2026-10-01" : null,
    rangeEnd: rows.length ? "2026-10-31" : null,
    unscheduledTaskIds: [],
  }),
  buildWbsGanttLinks: () => [],
  configureWbsGantt: vi.fn(),
}));

const { useWbsGanttChart } = await import("@/features/wbs/composables/useWbsGanttChart");

describe("useWbsGanttChart", () => {
  beforeEach(() => {
    mocks.mountedHooks = [];
    mocks.unmountHooks = [];
    mocks.instance = {
      config: {},
      init: vi.fn(),
      clearAll: vi.fn(),
      parse: vi.fn(),
      render: vi.fn(),
      destructor: vi.fn(),
    };
  });

  it("mount時にinstanceを初期化し、前後に余白を付けた期間でWBS行を描画する", async () => {
    const container = ref({});
    useWbsGanttChart(
      container,
      () => [{ taskId: 1 }],
      () => []
    );

    await mocks.mountedHooks[0]();

    expect(mocks.instance.init).toHaveBeenCalledWith(container.value);
    expect(mocks.instance.config.start_date).toBe("2026-10-01-3");
    expect(mocks.instance.config.end_date).toBe("2026-10-31+7");
    expect(mocks.instance.parse).toHaveBeenCalledWith({ data: [{ id: 1 }], links: [] });
  });

  it("描画先要素がない場合はinstanceを作らない", async () => {
    useWbsGanttChart(
      ref(null),
      () => [{ taskId: 1 }],
      () => []
    );

    await mocks.mountedHooks[0]();

    expect(mocks.instance.init).not.toHaveBeenCalled();
  });

  it("WBS行が変わると既存instanceへ全データを再投入する", async () => {
    const rows = ref([{ taskId: 1 }]);
    useWbsGanttChart(
      ref({}),
      () => rows.value,
      () => []
    );
    await mocks.mountedHooks[0]();

    rows.value = [{ taskId: 1 }, { taskId: 2 }];
    await nextTick();
    await nextTick();

    expect(mocks.instance.init).toHaveBeenCalledTimes(1);
    expect(mocks.instance.clearAll).toHaveBeenCalledTimes(2);
    expect(mocks.instance.parse).toHaveBeenLastCalledWith({
      data: [{ id: 1 }, { id: 2 }],
      links: [],
    });
  });

  it("unmount時にinstanceを破棄する", async () => {
    useWbsGanttChart(
      ref({}),
      () => [{ taskId: 1 }],
      () => []
    );
    await mocks.mountedHooks[0]();

    mocks.unmountHooks[0]();

    expect(mocks.instance.destructor).toHaveBeenCalledTimes(1);
  });
});
