/** Task checklistの一覧・作成・更新・並び替えResponse。 */
export interface TaskChecklistItem {
  checklistItemId: number;
  taskId: number;
  content: string;
  completed: boolean;
  position: number;
  createdBy: number;
  createdAt: string;
  updatedBy: number;
  updatedAt: string;
  /** 更新・並び替え・削除へ渡す取得時点の楽観ロックversion。 */
  version: number;
}

/** Task checklist追加Request。 */
export interface TaskChecklistItemCreateRequest {
  content: string;
}

/** Task checklist本文・完了状態更新Request。 */
export interface TaskChecklistItemUpdateRequest {
  content: string;
  completed: boolean;
  version: number;
}

/** Task checklistの並び順を全件指定するRequest。 */
export interface TaskChecklistOrderRequest {
  items: Array<{
    checklistItemId: number;
    version: number;
  }>;
}
