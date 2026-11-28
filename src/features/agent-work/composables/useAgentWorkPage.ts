import { computed, onMounted, onScopeDispose, ref, watch } from "vue";
import {
  AgentWorkApiError,
  getAgentWorkRecords,
  getAgentWorkSessions,
} from "@/features/agent-work/api/agentWorkApi";
import type {
  AgentWorkRecordPage,
  AgentWorkSession,
  AgentWorkSessionPage,
  AgentWorkStatus,
} from "@/features/agent-work/types/agentWork";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { useUserStore } from "@/features/auth/stores/user";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { isUnauthorizedApiError } from "@/shared/utils/apiError";
import { createLatestRequestTracker } from "@/shared/utils/latestRequest";

/** 一覧と成果の共通ページ件数。Backendの100件上限以下とする。 */
const PAGE_SIZE = 20;
/** Backendの深いページ上限。 */
const MAX_OFFSET = 100000;

/**
 * 本人AI作業のfilter・paging・成果参照を管理する。書込・token保存・定期pollingは行わない。
 * 401・参照範囲変更・画面破棄では表示と遅延応答を破棄する。通信失敗では直前表示を維持する。
 */
export const useAgentWorkPage = () => {
  const userStore = useUserStore();
  const { expireSession } = useSessionExpiry();
  const canRead = computed(
    () => userStore.accountId !== null && userStore.hasPermission("TASK_READ")
  );
  const statusFilter = ref<AgentWorkStatus | "ALL">("RUNNING");
  const page = ref<AgentWorkSessionPage | null>(null);
  const records = ref<AgentWorkRecordPage | null>(null);
  const selectedSession = ref<AgentWorkSession | null>(null);
  const offset = ref(0);
  const recordOffset = ref(0);
  const isLoading = ref(false);
  const isRecordsLoading = ref(false);
  const errorMessages = ref<string[]>([]);
  const recordErrorMessages = ref<string[]>([]);
  const listTracker = createLatestRequestTracker();
  const recordsTracker = createLatestRequestTracker();
  let activeListQuery: string | null = null;

  /** Dialogのclose後に遅れた成果応答で表示を復元しない。 */
  const closeRecords = (): void => {
    recordsTracker.begin();
    selectedSession.value = null;
    records.value = null;
    recordOffset.value = 0;
    recordErrorMessages.value = [];
    isRecordsLoading.value = false;
  };

  /** 認証・参照範囲変更と画面破棄で並列応答と旧表示をまとめて失効させる。 */
  const clearPage = (): void => {
    listTracker.begin();
    activeListQuery = null;
    page.value = null;
    offset.value = 0;
    isLoading.value = false;
    closeRecords();
  };

  /** 401だけをSession失効とし、403・404では旧参照範囲を破棄する。Backend本文は直接表示しない。 */
  const handleFailure = async (error: unknown, forRecords: boolean): Promise<void> => {
    if (isUnauthorizedApiError(error)) {
      await expireSession(clearPage);
      return;
    }
    if (error instanceof AgentWorkApiError && (error.status === 403 || error.status === 404)) {
      clearPage();
      errorMessages.value = [DISPLAY_MESSAGES.agentWork.readUnavailable];
      return;
    }
    const destination = forRecords ? recordErrorMessages : errorMessages;
    destination.value = [DISPLAY_MESSAGES.agentWork.loadFailed];
  };

  /** 指定filter・offsetの最新応答だけを反映し、同じ検索の重複送信を抑止する。 */
  const loadSessions = async (nextOffset = offset.value): Promise<void> => {
    if (!canRead.value || nextOffset < 0 || nextOffset > MAX_OFFSET) return;
    const filter = statusFilter.value;
    const queryKey = `${filter}:${nextOffset}`;
    if (activeListQuery === queryKey) return;
    activeListQuery = queryKey;
    const isCurrent = listTracker.begin();
    isLoading.value = true;
    errorMessages.value = [];
    try {
      const loaded = await getAgentWorkSessions(
        filter === "ALL" ? undefined : filter,
        PAGE_SIZE,
        nextOffset
      );
      if (!isCurrent()) return;
      page.value = loaded;
      offset.value = nextOffset;
    } catch (error: unknown) {
      if (isCurrent()) await handleFailure(error, false);
    } finally {
      if (isCurrent()) {
        isLoading.value = false;
        activeListQuery = null;
      }
    }
  };

  /** 選択した作業の成果だけを反映し、別作業への切替・closeで古い応答を捨てる。 */
  const loadRecords = async (session: AgentWorkSession, nextOffset = 0): Promise<void> => {
    if (!canRead.value || nextOffset < 0 || nextOffset > MAX_OFFSET) return;
    const isCurrent = recordsTracker.begin();
    if (selectedSession.value?.sessionId !== session.sessionId) records.value = null;
    selectedSession.value = session;
    isRecordsLoading.value = true;
    recordErrorMessages.value = [];
    try {
      const loaded = await getAgentWorkRecords(session, PAGE_SIZE, nextOffset);
      if (!isCurrent()) return;
      records.value = loaded;
      recordOffset.value = nextOffset;
    } catch (error: unknown) {
      if (isCurrent()) await handleFailure(error, true);
    } finally {
      if (isCurrent()) isRecordsLoading.value = false;
    }
  };

  const isRecordsOpen = computed({
    get: () => selectedSession.value !== null,
    set: (open: boolean) => {
      if (!open) closeRecords();
    },
  });
  const canPrevious = computed(() => offset.value > 0 && !isLoading.value);
  const canNext = computed(
    () =>
      !isLoading.value &&
      offset.value + PAGE_SIZE < (page.value?.totalElements ?? 0) &&
      offset.value + PAGE_SIZE <= MAX_OFFSET
  );
  const canPreviousRecords = computed(() => recordOffset.value > 0 && !isRecordsLoading.value);
  const canNextRecords = computed(
    () =>
      !isRecordsLoading.value &&
      recordOffset.value + PAGE_SIZE < (records.value?.totalElements ?? 0) &&
      recordOffset.value + PAGE_SIZE <= MAX_OFFSET
  );

  /** 一覧と開いている成果を明示更新する。定期RequestでSession期限を延長しない。 */
  const reload = async (): Promise<void> => {
    const selected = selectedSession.value;
    await Promise.all([
      loadSessions(),
      ...(selected ? [loadRecords(selected, recordOffset.value)] : []),
    ]);
  };

  /** 画面復帰時だけ状態を確認し、非表示中の背景通信を行わない。 */
  const refreshOnFocus = (): void => {
    if (document.visibilityState === "visible") void reload();
  };

  watch(statusFilter, () => {
    clearPage();
    void loadSessions(0);
  });
  watch(
    () => `${userStore.accountId}:${canRead.value}`,
    () => {
      clearPage();
      if (canRead.value) void loadSessions(0);
    }
  );
  onMounted(() => {
    void loadSessions(0);
    window.addEventListener("focus", refreshOnFocus);
  });
  onScopeDispose(() => {
    clearPage();
    window.removeEventListener("focus", refreshOnFocus);
  });

  return {
    canRead,
    statusFilter,
    page,
    records,
    selectedSession,
    offset,
    recordOffset,
    isLoading,
    isRecordsLoading,
    errorMessages,
    recordErrorMessages,
    isRecordsOpen,
    canPrevious,
    canNext,
    canPreviousRecords,
    canNextRecords,
    loadSessions,
    loadRecords,
    closeRecords,
    reload,
    nextPage: () => {
      if (canNext.value) void loadSessions(offset.value + PAGE_SIZE);
    },
    previousPage: () => {
      if (canPrevious.value) void loadSessions(offset.value - PAGE_SIZE);
    },
    nextRecords: () => {
      if (canNextRecords.value && selectedSession.value)
        void loadRecords(selectedSession.value, recordOffset.value + PAGE_SIZE);
    },
    previousRecords: () => {
      if (canPreviousRecords.value && selectedSession.value)
        void loadRecords(selectedSession.value, recordOffset.value - PAGE_SIZE);
    },
  };
};
