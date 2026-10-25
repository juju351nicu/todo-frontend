<script setup lang="ts">
import { useInquiryFormPage } from "@/features/inquiry/composables/useInquiryFormPage";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  email,
  errorMessages,
  fullName,
  isLoading,
  message,
  submit,
  successMessage,
} = useInquiryFormPage();
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <div class="page-container">
    <StatusAlert v-if="successMessage" type="success" class="mb-4">
      {{ successMessage }}
    </StatusAlert>
    <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="errorMessage in errorMessages" :key="errorMessage">
        {{ errorMessage }}
      </div>
    </StatusAlert>
    <UCard class="w-200" :ui="{ footer: 'p-0 sm:p-0 min-h-0' }">
      <template #header>
        <h4 class="text-base font-bold">企業広告等のお問い合わせはこちらからお願いします。</h4>
        <p class="text-base font-normal leading-normal tracking-normal">
          お問い合わせありがとうございます。<br />
          ご返信までに３～４日頂く場合がございます。
        </p>
      </template>
      <UFormField label="氏名(必須)">
        <UInput v-model="fullName" placeholder="お名前" required class="w-full" />
      </UFormField>
      <UFormField label="メールアドレス(必須)">
        <UInput v-model="email" placeholder="メールアドレス" required class="w-full" />
      </UFormField>
      <UFormField label="お問い合わせ内容(必須)">
        <UTextarea v-model="message" :rows="5" class="w-full" />
      </UFormField>
      <template #footer>
        <UButton color="success" size="lg" class="mt-2 w-192" :disabled="isLoading" @click="submit">
          送信する
        </UButton>
      </template>
    </UCard>
  </div>
  <br />
  <h6 class="text-[0.67em] font-bold">プライバシーポリシー(個人情報に関する基本方針)</h6>
  <p>
    当社では，お客様の個人情報の重要性を認識し適切な収集と利用を図るとともに，個人情報の
    正確性と機密性を確保するため，個人情報保護に関する法令及びその他の規範を遵守，自主的
    なルール・体制を確立し，定めた個人情報保護方針を実行し維持します。
  </p>
</template>
