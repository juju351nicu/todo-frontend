import { ref } from "vue";
import type { Ref } from "vue";

import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import type { WbsReportDownload, WbsReportType } from "@/features/wbs/types/wbs";
import { resolveWbsErrorMessages } from "@/features/wbs/utils/apiErrors";
import { validateEarnedValueStatusDate } from "@/features/wbs/utils/earnedValue";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

/**
 * Backendから受け取ったExcel Blobをbrowserの一時URLで保存し、使用後に必ず解放する。
 * 一時URLやbinaryをStore・localStorageへ残さず、実行中のdownloadだけに閉じ込める。
 */
const saveWbsReportDownload = (file: WbsReportDownload): void => {
  const objectUrl = URL.createObjectURL(file.content);
  const anchor = document.createElement("a");
  try {
    anchor.href = objectUrl;
    anchor.download = file.fileName;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
};

/**
 * WBS画面の週次・月次Excel帳票のdownload状態を管理する。
 *
 * - 呼び出すAPI: `WbsApi.downloadWbsReport`（Project配下の`GET /wbs/exports/{reportType}`）。
 * - 帳票はactive baseline基準のEVMを含むため、基準日はEVM cardと共有する`statusDate`を更新する。
 * - 1回のdownloadが終わるまで次のdownloadを受け付けない。
 *
 * @param context Project IDとSession失効処理を提供する画面共通context
 * @param statusDate EVMと共有するyyyy-MM-dd形式の基準日。download開始時に指定値へ更新する
 */
export const useWbsReportExport = (
  context: WbsPageContext,
  statusDate: Ref<string>
) => {
  /** download中の帳票種別。download中でなければnull。 */
  const exportingReportType = ref<WbsReportType | null>(null);
  const reportExportErrorMessages = ref<string[]>([]);
  const reportExportSuccessMessage = ref("");

  /**
   * 共通基準日を検証し、週次または月次WBS Excel帳票を1回だけdownloadする。
   *
   * @param reportType 週次または月次の帳票期間
   * @param requestedStatusDate EVMと帳票期間に使用するyyyy-MM-dd形式の基準日
   */
  const downloadWbsReport = async (
    reportType: WbsReportType,
    requestedStatusDate: string
  ): Promise<void> => {
    const projectId = context.projectId.value;
    if (projectId === null || exportingReportType.value !== null) {
      return;
    }
    if (validateEarnedValueStatusDate(requestedStatusDate).length > 0) {
      reportExportErrorMessages.value = [
        "Excel帳票の基準日を入力してください。",
      ];
      return;
    }

    exportingReportType.value = reportType;
    statusDate.value = requestedStatusDate;
    reportExportErrorMessages.value = [];
    reportExportSuccessMessage.value = "";
    try {
      const file = await WbsApi.downloadWbsReport(
        projectId,
        reportType,
        requestedStatusDate
      );
      saveWbsReportDownload(file);
      reportExportSuccessMessage.value = `${reportType === "weekly" ? "週次" : "月次"}Excel帳票をダウンロードしました。`;
    } catch (error: unknown) {
      await handleWbsReportDownloadError(error);
    } finally {
      exportingReportType.value = null;
    }
  };

  /** Excel download APIのstatusを帳票cardの案内またはSession動作へ変換する。 */
  const handleWbsReportDownloadError = async (
    error: unknown
  ): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      reportExportErrorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      await context.handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      reportExportErrorMessages.value = [DISPLAY_MESSAGES.wbs.report.forbidden];
      return;
    }
    if (error.status === 404) {
      reportExportErrorMessages.value = [DISPLAY_MESSAGES.wbs.projectNotFound];
      return;
    }
    if (error.status === 409) {
      reportExportErrorMessages.value = resolveWbsErrorMessages(
        error,
        DISPLAY_MESSAGES.wbs.report.activeBaselineRequired
      );
      return;
    }
    reportExportErrorMessages.value = resolveWbsErrorMessages(
      error,
      DISPLAY_MESSAGES.wbs.report.downloadFailed
    );
  };

  /** 画面の再読込時に、前回downloadの結果messageを残さない。 */
  const clearReportExportMessages = (): void => {
    reportExportErrorMessages.value = [];
    reportExportSuccessMessage.value = "";
  };

  return {
    clearReportExportMessages,
    downloadWbsReport,
    exportingReportType,
    reportExportErrorMessages,
    reportExportSuccessMessage,
  };
};
