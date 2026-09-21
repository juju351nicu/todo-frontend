import type {
  ProjectTemplate,
  ProjectTemplateApplyRequest,
  ProjectTemplateApplyResponse,
  ProjectTemplateCaptureRequest,
  ProjectTemplateSummary,
  ProjectTemplateUpdateRequest,
} from "@/features/project/types/projectTemplate";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";

/** Project Template APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class ProjectTemplateApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`Project Template APIの実行に失敗しました。status=${status}`);
    this.name = "ProjectTemplateApiError";
    this.status = status;
    this.errorResponse = errorResponse;
  }
}

/** JSON形式とは限らないSecurityエラーResponseを安全に読み取る。 */
const readErrorResponse = async (
  response: Response
): Promise<ErrorResponse | null> => {
  try {
    return (await response.json()) as ErrorResponse;
  } catch (_error: unknown) {
    return null;
  }
};

/** 非2xx ResponseをProjectTemplateApiErrorへ変換する。 */
const ensureSuccess = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new ProjectTemplateApiError(
      response.status,
      await readErrorResponse(response)
    );
  }
};

/** 認証中の本人が所有するactive Project Template headerを取得する。 */
const findOwnTemplates = async (): Promise<ProjectTemplateSummary[]> => {
  const response = await HttpClient.getRequest(API_PATHS.PROJECT_TEMPLATES);
  await ensureSuccess(response);
  return (await response.json()) as ProjectTemplateSummary[];
};

/** 本人所有のactive Project Template snapshot全体を取得する。 */
const getOwnTemplate = async (
  projectTemplateId: number
): Promise<ProjectTemplate> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECT_TEMPLATES}/${projectTemplateId}`
  );
  await ensureSuccess(response);
  return (await response.json()) as ProjectTemplate;
};

/** ACTIVE ProjectのBoard・member・WBS構造を本人所有Templateへ保存する。 */
const capture = async (
  projectId: number,
  payload: ProjectTemplateCaptureRequest
): Promise<ProjectTemplate> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECTS}/${projectId}/templates`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as ProjectTemplate;
};

/** 本人所有Project Templateの名称と生成Project用説明をversion付きで更新する。 */
const update = async (
  projectTemplateId: number,
  payload: ProjectTemplateUpdateRequest
): Promise<ProjectTemplate> => {
  const response = await HttpClient.putRequest(
    `${API_PATHS.PROJECT_TEMPLATES}/${projectTemplateId}`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as ProjectTemplate;
};

/** 本人所有Project Templateを取得時点version付きで論理archiveする。 */
const archive = async (
  projectTemplateId: number,
  version: number
): Promise<void> => {
  const query = new URLSearchParams({ version: String(version) });
  const response = await HttpClient.deleteRequest(
    `${API_PATHS.PROJECT_TEMPLATES}/${projectTemplateId}?${query}`
  );
  await ensureSuccess(response);
};

/** Project Template snapshotからmember・Board・WBSを含む通常Projectを生成する。 */
const apply = async (
  projectTemplateId: number,
  payload: ProjectTemplateApplyRequest
): Promise<ProjectTemplateApplyResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECT_TEMPLATES}/${projectTemplateId}/projects`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as ProjectTemplateApplyResponse;
};

export default {
  apply,
  archive,
  capture,
  findOwnTemplates,
  getOwnTemplate,
  update,
};
