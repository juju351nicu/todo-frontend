import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";
import { useWbsReportExport } from "@/features/wbs/composables/useWbsReportExport";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

import {
  buildWbsPageContext,
  mocks,
  wbs,
  project,
  resetWbsPageMocks,
} from "./wbsPageTestSupport";

vi.mock("vue-router", async () => {
  const { mocks } = await import("./wbsPageTestSupport");
  return { useRoute: () => mocks.route, useRouter: () => mocks.router };
});
vi.mock("@/features/auth/stores/user", async () => {
  const { mocks } = await import("./wbsPageTestSupport");
  return { useUserStore: () => mocks.userStore };
});
vi.mock("@/features/project/api/projectApi", async () => {
  const actual = await vi.importActual("@/features/project/api/projectApi");
  const { mocks } = await import("./wbsPageTestSupport");
  return { ...actual, default: mocks.projectApi };
});
vi.mock("@/features/wbs/api/wbsApi", async () => {
  const actual = await vi.importActual("@/features/wbs/api/wbsApi");
  const { mocks } = await import("./wbsPageTestSupport");
  return { ...actual, default: mocks.wbsApi };
});

describe("useWbsReportExport", () => {
  beforeEach(resetWbsPageMocks);

  it("指定基準日の週次Excelを1回保存して一時Blob URLを解放する", async () => {
    const page = useWbsPage();
    await page.initialize();

    await page.downloadWbsReport("weekly", "2026-09-05");

    expect(mocks.wbsApi.downloadWbsReport).toHaveBeenCalledWith(
      7,
      "weekly",
      "2026-09-05"
    );
    expect(mocks.createObjectUrl).toHaveBeenCalledOnce();
    expect(mocks.appendDownloadAnchor).toHaveBeenCalledOnce();
    expect(mocks.clickDownloadAnchor).toHaveBeenCalledOnce();
    expect(mocks.removeDownloadAnchor).toHaveBeenCalledOnce();
    expect(mocks.revokeObjectUrl).toHaveBeenCalledWith("blob:wbs-report");
    expect(page.earnedValueStatusDate.value).toBe("2026-09-05");
    expect(page.reportExportSuccessMessage.value).toBe(
      "週次Excel帳票をダウンロードしました。"
    );
    expect(page.exportingReportType.value).toBeNull();
  });

  it("不正なExcel基準日ではAPIを呼ばず入力理由を表示する", async () => {
    const page = useWbsPage();
    await page.initialize();

    await page.downloadWbsReport("monthly", "2026-02-29");

    expect(mocks.wbsApi.downloadWbsReport).not.toHaveBeenCalled();
    expect(page.reportExportErrorMessages.value).toEqual([
      "Excel帳票の基準日を入力してください。",
    ]);
  });

  it("Excel生成中の再操作は無視して二重downloadを防ぐ", async () => {
    let resolveDownload;
    mocks.wbsApi.downloadWbsReport.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDownload = resolve;
        })
    );
    const page = useWbsPage();
    await page.initialize();

    const firstDownload = page.downloadWbsReport("monthly", "2026-09-05");
    await page.downloadWbsReport("weekly", "2026-09-05");

    expect(page.exportingReportType.value).toBe("monthly");
    expect(mocks.wbsApi.downloadWbsReport).toHaveBeenCalledTimes(1);
    resolveDownload({
      content: new Blob(["xlsx-binary"]),
      fileName: "work-management-wbs-monthly-project-7-2026-09-05.xlsx",
    });
    await firstDownload;
    expect(page.exportingReportType.value).toBeNull();
  });

  it("Excel downloadの409ではBackend理由を表示して保存処理を行わない", async () => {
    mocks.wbsApi.downloadWbsReport.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "WBS_EVM_ACTIVE_BASELINE_REQUIRED",
            field: "projectId",
            message: "active baselineが必要です。",
          },
        ],
      })
    );
    const page = useWbsPage();
    await page.initialize();

    await page.downloadWbsReport("weekly", "2026-09-05");

    expect(page.reportExportErrorMessages.value).toEqual([
      "active baselineが必要です。",
    ]);
    expect(mocks.createObjectUrl).not.toHaveBeenCalled();
  });

  it("Excel downloadの本文なし403をSession失効にせず権限不足として表示する", async () => {
    mocks.wbsApi.downloadWbsReport.mockRejectedValue(
      new WbsApiError(403, null)
    );
    const page = useWbsPage();
    await page.initialize();

    await page.downloadWbsReport("weekly", "2026-09-05");

    expect(page.reportExportErrorMessages.value).toEqual([
      "Excel帳票を出力するpermissionがありません。",
    ]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(mocks.createObjectUrl).not.toHaveBeenCalled();
  });

  it("Excel downloadの未知codeは帳票用fallbackへ閉じる", async () => {
    mocks.wbsApi.downloadWbsReport.mockRejectedValue(
      new WbsApiError(500, {
        fieldErrors: [
          {
            errorCode: "UNKNOWN_WBS_REPORT_ERROR",
            field: "report",
            message: "内部情報を含み得る未契約文言",
          },
        ],
      })
    );
    const page = useWbsPage();
    await page.initialize();

    await page.downloadWbsReport("monthly", "2026-09-05");

    expect(page.reportExportErrorMessages.value).toEqual([
      "Excel帳票をダウンロードできませんでした。",
    ]);
    expect(mocks.createObjectUrl).not.toHaveBeenCalled();
  });

  it("Excel downloadの401ではSessionを破棄してログイン画面へ遷移する", async () => {
    mocks.wbsApi.downloadWbsReport.mockRejectedValue(
      new WbsApiError(401, null)
    );
    const page = useWbsPage();
    await page.initialize();

    await page.downloadWbsReport("monthly", "2026-09-05");

    expect(mocks.userStore.clearSession).toHaveBeenCalledTimes(1);
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    expect(mocks.createObjectUrl).not.toHaveBeenCalled();
  });

  describe("contextを直接渡した場合", () => {
    it("Project IDがなければdownload APIを呼ばず基準日も変えない", async () => {
      const statusDate = ref("2026-08-30");
      const state = useWbsReportExport(
        buildWbsPageContext({ projectId: { value: null } }),
        statusDate
      );

      await state.downloadWbsReport("monthly", "2026-09-30");

      expect(mocks.wbsApi.downloadWbsReport).not.toHaveBeenCalled();
      expect(statusDate.value).toBe("2026-08-30");
    });

    it("月次帳票のdownload成功を案内し、共有された基準日を更新する", async () => {
      const statusDate = ref("2026-08-30");
      const state = useWbsReportExport(buildWbsPageContext(), statusDate);

      await state.downloadWbsReport("monthly", "2026-09-30");

      expect(mocks.wbsApi.downloadWbsReport).toHaveBeenCalledWith(
        7,
        "monthly",
        "2026-09-30"
      );
      expect(statusDate.value).toBe("2026-09-30");
      expect(state.reportExportSuccessMessage.value).toBe(
        "月次Excel帳票をダウンロードしました。"
      );
    });

    it.each([
      [new WbsApiError(404, null), DISPLAY_MESSAGES.wbs.projectNotFound],
      [new WbsApiError(500, null), DISPLAY_MESSAGES.wbs.report.downloadFailed],
      [new TypeError("Failed to fetch"), DISPLAY_MESSAGES.common.connectionFailed],
    ])("download失敗%sを帳票cardの案内へ変換する", async (error, message) => {
      mocks.wbsApi.downloadWbsReport.mockRejectedValue(error);
      const state = useWbsReportExport(buildWbsPageContext(), ref("2026-08-30"));

      await state.downloadWbsReport("weekly", "2026-09-05");

      expect(state.reportExportErrorMessages.value).toEqual([message]);
      expect(state.exportingReportType.value).toBeNull();
      expect(mocks.createObjectUrl).not.toHaveBeenCalled();
    });

    it("downloadの後は押したボタンへフォーカスを戻す", async () => {
      const state = useWbsReportExport(buildWbsPageContext(), ref("2026-08-31"));

      await state.downloadWbsReport("monthly", "2026-08-31");

      expect(mocks.focusedControls).toEqual(["monthly"]);
    });

    it("clearReportExportMessagesは前回downloadの結果messageを破棄する", async () => {
      const state = useWbsReportExport(buildWbsPageContext(), ref("2026-08-30"));
      await state.downloadWbsReport("weekly", "2026-09-05");
      state.reportExportErrorMessages.value = ["古いエラー"];

      state.clearReportExportMessages();

      expect(state.reportExportErrorMessages.value).toEqual([]);
      expect(state.reportExportSuccessMessage.value).toBe("");
    });
  });
});
