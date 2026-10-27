<script setup lang="ts">
import type { TaskDependencyRow } from "@/features/wbs/types/wbs";
import StatusAlert from "@/shared/components/StatusAlert.vue";

/** Task依存関係cardへ親画面から渡す一覧と操作状態。追加・削除の処理は親composable（`useWbsDependencies`）が行う。 */
interface Props {
  /** 表示名と削除可否を付けた依存関係の一覧。 */
  dependencyRows: TaskDependencyRow[];
  /** TASK_UPDATEを持つか。falseなら追加ボタンと操作列を出さない。 */
  canEdit: boolean;
  /** 先行・後続に選べるTaskが2件以上あり、追加Dialogを開けるか。 */
  canAdd: boolean;
  /** 追加・削除の処理中か。処理中はボタンを押せなくする。 */
  isMutating: boolean;
  /** Dialog外の操作（追加後・削除・競合）の失敗理由。 */
  errorMessages: string[];
  /** 直前の追加・削除の成功message。 */
  successMessage: string;
}

defineProps<Props>();
const emit = defineEmits<{
  /** 追加Dialogを開く。 */
  add: [];
  /** 指定した依存関係の削除確認を開く。 */
  requestDelete: [dependencyId: number];
}>();
</script>

<template>
  <UCard class="mx-auto mt-4 max-w-400" :ui="{ body: 'p-0 sm:p-0 not-first:pt-0' }">
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <UIcon name="i-mdi-vector-link" class="size-6" />
        Task依存関係
        <UBadge size="sm" variant="outline">{{ dependencyRows.length }}件</UBadge>
        <UButton
          v-if="canEdit"
          icon="i-mdi-link-plus"
          color="primary"
          variant="soft"
          class="ms-auto"
          :disabled="!canAdd || isMutating"
          @click="emit('add')"
        >
          依存関係を追加
        </UButton>
      </div>
    </template>

    <!-- 依存関係cardは画面の下部にあるため、操作結果は画面上部ではなくcard内に出す。 -->
    <div v-if="errorMessages.length || successMessage" class="flex flex-col gap-3 px-4 pt-4 sm:px-6">
      <StatusAlert v-if="errorMessages.length" type="error">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <StatusAlert v-if="successMessage" type="success">{{ successMessage }}</StatusAlert>
    </div>

    <div v-if="dependencyRows.length" class="overflow-x-auto">
      <table class="app-table app-table-hover min-w-205 [&_td]:h-13 [&_th]:h-13">
        <thead>
          <tr>
            <th scope="col">先行Task</th>
            <th scope="col">後続Task</th>
            <th scope="col">依存種別</th>
            <th scope="col">待ち時間</th>
            <th v-if="canEdit" scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="dependency in dependencyRows" :key="dependency.dependencyId">
            <td>{{ dependency.predecessorLabel }}</td>
            <td>
              <!-- Tailwindの既定でsvgはblock表示になるため、矢印とTask名をflexで同じ行に並べる。 -->
              <span class="inline-flex items-center gap-2">
                <UIcon name="i-mdi-arrow-right" class="size-5 shrink-0" />
                {{ dependency.successorLabel }}
              </span>
            </td>
            <td><UBadge size="xs" variant="outline">Finish-to-Start</UBadge></td>
            <td>{{ dependency.lagMinutes }}分</td>
            <td v-if="canEdit">
              <span v-if="!dependency.canDelete" class="text-xs text-muted">参照のみ</span>
              <UButton
                v-else
                icon="i-mdi-link-variant-remove"
                color="error"
                size="sm"
                variant="ghost"
                square
                :disabled="isMutating"
                :aria-label="`${dependency.predecessorLabel}から${dependency.successorLabel}への依存関係を削除`"
                @click="emit('requestDelete', dependency.dependencyId)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="p-8 text-center">
      <UIcon name="i-mdi-vector-link" class="mb-2 size-10" />
      <p class="mb-0 text-sm text-muted">Task依存関係はまだ登録されていません。</p>
    </div>
  </UCard>
</template>
