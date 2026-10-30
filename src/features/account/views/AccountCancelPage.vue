<script setup lang="ts">
import { toRef } from "vue";

import { useAccountCancelPage } from "@/features/account/composables/useAccountCancelPage";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";

const props = defineProps<{
  id: number;
}>();

const { clearPassword, confirmCancellation, isLoading, message, password } = useAccountCancelPage(
  toRef(props, "id")
);
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <div class="page-container">
    <p>
      アカウントを削除して退会されたい場合は、以下の注意事項をご確認の上、お手続きいただきますようお願いいたします。
    </p>
    <ul class="list-disc">
      <li>
        アカウントを削除されますと、関連するすべてのデータが削除されます。また、操作の取り消しはできません。
      </li>
      <li>
        アカウントを削除した後、同じユーザー名で再登録はできません。同じユーザー名で再登録されたい場合は、ユーザー名を変更してからアカウントを削除してください。
      </li>
    </ul>
    <p>
      ご了承いただけましたらパスワードを入力して「上記に同意してアカウントを削除する」をクリックしてください。
    </p>

    <h4 class="p-8 text-center text-xl font-bold">パスワードの確認</h4>
    <USeparator />
    <UFormField label="パスワード">
      <UInput v-model="password" type="password" name="password" class="w-full" />
    </UFormField>
    <UButton class="me-4" color="success" @click="confirmCancellation"
      >上記に同意してアカウントを削除する</UButton
    >
    <UButton @click="clearPassword">クリア</UButton>
    <p class="text-[red]">{{ message }}</p>
  </div>
</template>
