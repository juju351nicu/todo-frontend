/** BackendのTask Timer Session状態コード。 */
export type TaskTimeSessionStatus = "RUNNING" | "STOPPED" | "CANCELED";

/** 実行中の本人Task Timer。 */
export interface TaskTimer {
  /** Task Timer Session ID。 */
  timerSessionId: number;
  /** Timer開始時のProject ID。 */
  projectId: number;
  /** Timer開始時のProject key。 */
  projectKey: string;
  /** Timer開始時のProject表示名。 */
  projectName: string;
  /** Board・WBSと共通のTask ID。 */
  taskId: number;
  /** Timer対象Taskの表示名。 */
  taskTitle: string;
  /** Asia/Tokyo offset付きのBackend確定開始時刻。 */
  startedAt: string;
  /** Response生成時点までの経過秒数。 */
  elapsedSeconds: number;
  /** 停止・取消に使用する楽観ロックversion。 */
  version: number;
}

/** 現在Timerと経過表示の基準となるBackend時刻。 */
export interface CurrentTaskTimerResponse {
  /** Asia/Tokyo offset付きのResponse生成時刻。 */
  serverTime: string;
  /** 本人のRUNNING Timer。実行中でなければnull。 */
  timer: TaskTimer | null;
}

/** 現在Timerの停止・取消Request。 */
export interface TaskTimerVersionRequest {
  /** 現在Timer取得時点の楽観ロックversion。 */
  version: number;
}

/** 停止したTimerの1業務日分の配賦結果。 */
export interface TaskTimerAllocation {
  /** Asia/Tokyoの日境界で分割した業務日。 */
  workDate: string;
  /** 今回Sessionのうち当該業務日に属する秒数。 */
  elapsedSeconds: number;
  /** 日別実績へ今回加算された分数。 */
  creditedMinutes: number;
  /** 加算対象の日別実績ID。0分時はnull。 */
  workLogId: number | null;
  /** Timer加算後の日別実績分数。0分時はnull。 */
  actualEffortMinutes: number | null;
}

/** 本人のTask Timer Session履歴1件。 */
export interface TaskTimerSession {
  /** Task Timer Session ID。 */
  timerSessionId: number;
  /** Timer開始時のProject ID。 */
  projectId: number;
  /** Timer開始時のProject key。 */
  projectKey: string;
  /** Timer開始時のProject表示名。 */
  projectName: string;
  /** Board・WBSと共通のTask ID。 */
  taskId: number;
  /** Timer対象Taskの表示名。 */
  taskTitle: string;
  /** RUNNING、STOPPED、CANCELEDのSession状態。 */
  statusCode: TaskTimeSessionStatus;
  /** Asia/Tokyo offset付きの開始時刻。 */
  startedAt: string;
  /** Asia/Tokyo offset付きの停止・取消時刻。RUNNINGではnull。 */
  stoppedAt: string | null;
  /** STOPPED時の確定秒数。RUNNINGとCANCELEDではnull。 */
  durationSeconds: number | null;
  /** Sessionの楽観ロックversion。 */
  version: number;
}

/** Timer停止で確定したSessionと日別配賦。 */
export interface TaskTimerStopResponse {
  /** Asia/Tokyo offset付きの停止処理時刻。 */
  serverTime: string;
  /** STOPPEDへ確定したTask Timer Session。 */
  session: TaskTimerSession;
  /** 業務日昇順の日別配賦結果。 */
  allocations: TaskTimerAllocation[];
}

/** 本人Timer Session履歴の検索条件。 */
export interface TaskTimerSessionSearch {
  /** 開始日の下限。yyyy-MM-dd形式。 */
  dateFrom: string;
  /** 開始日の上限。yyyy-MM-dd形式。 */
  dateTo: string;
  /** 0始まりのページ番号。 */
  page: number;
  /** 1ページ当たりの取得件数。 */
  size: number;
}

/** 本人Timer Session履歴とページ情報。 */
export interface TaskTimerSessionListResponse extends TaskTimerSessionSearch {
  /** 開始時刻とSession IDの降順で取得した本人Session。 */
  sessions: TaskTimerSession[];
  /** 検索条件に一致するSession総件数。 */
  totalElements: number;
  /** 総ページ数。0件の場合は0。 */
  totalPages: number;
}

/** Task日別実績工数の監査操作コード。 */
export type TaskWorkLogAuditAction =
  | "MANUAL_CREATE"
  | "MANUAL_UPDATE"
  | "MANUAL_DELETE"
  | "TIMER_APPLY";

/** Task日別実績工数の手入力・Timer加算履歴1件。 */
export interface TaskWorkLogAudit {
  /** Task実績工数監査ID。 */
  workLogAuditId: number;
  /** 操作時点の日別実績工数ID。 */
  workLogId: number;
  /** 実績工数の作業者account ID。 */
  workerAccountId: number;
  /** 監査対象の業務日。 */
  workDate: string;
  /** 手入力またはTimer加算の操作コード。 */
  actionCode: TaskWorkLogAuditAction;
  /** 変更前分数。新規登録ではnull。 */
  beforeMinutes: number | null;
  /** 変更後分数。削除ではnull。 */
  afterMinutes: number | null;
  /** TIMER_APPLYの根拠Session ID。手入力ではnull。 */
  timerSessionId: number | null;
  /** 操作した認証済みaccount ID。 */
  actorAccountId: number;
  /** Backendが確定したISO-8601形式の監査時刻。 */
  occurredAt: string;
}

/** 指定Taskの日別実績工数監査とページ情報。 */
export interface TaskWorkLogAuditListResponse {
  /** 監査対象Project ID。 */
  projectId: number;
  /** 監査対象Task ID。 */
  taskId: number;
  /** 操作時刻と監査IDの降順で取得した監査。 */
  audits: TaskWorkLogAudit[];
  /** 0始まりのページ番号。 */
  page: number;
  /** 1ページ当たりの取得件数。 */
  size: number;
  /** 対象Taskの監査総件数。 */
  totalElements: number;
  /** 総ページ数。0件の場合は0。 */
  totalPages: number;
}
