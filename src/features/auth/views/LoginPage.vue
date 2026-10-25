<script setup lang="ts">
import { onMounted } from "vue";

import { useLoginPage } from "@/features/auth/composables/useLoginPage";
import AppAlert from "@/shared/components/AppAlert.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";

const {
  errorMessages,
  initialize,
  isLoading,
  isShowModal,
  loginForm,
  showPassword,
  submitForm,
  submitGithub,
  submitRegister,
} = useLoginPage();

onMounted(initialize);
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <template v-if="isShowModal">
    <div v-for="(message, index) in errorMessages" :key="index" class="flex justify-end">
      <AppAlert class="mx-4" :message="message" type="error" />
    </div>
  </template>
  <UCard class="mx-auto mt-9 w-93.5" :ui="{ body: 'flex flex-col justify-center px-4 pt-0 pb-4' }">
    <h1 class="mt-6 text-center text-xl font-medium leading-8 tracking-[.0125em]">ログイン</h1>
    <p class="mt-3 pt-3 text-center text-base tracking-[.009375em]">ログインIDでログイン</p>
    <form class="mx-9" @submit.prevent="submitForm">
      <UFormField>
        <UInput
          v-model="loginForm.loginId"
          name="loginId"
          type="text"
          icon="i-mdi-account"
          placeholder="ログインID"
          autocomplete="username"
          class="w-full"
        />
      </UFormField>
      <UFormField>
        <UInput
          v-model="loginForm.password"
          name="password"
          :type="showPassword ? 'text' : 'password'"
          icon="i-mdi-lock"
          placeholder="パスワード"
          autocomplete="current-password"
          class="w-full"
        >
          <template #trailing>
            <UButton
              :icon="showPassword ? 'i-mdi-eye' : 'i-mdi-eye-off'"
              variant="ghost"
              square
              size="sm"
              class="text-black/60"
              :ui="{ leadingIcon: 'size-6' }"
              :aria-label="showPassword ? 'パスワードを隠す' : 'パスワードを表示'"
              @click="showPassword = !showPassword"
            />
          </template>
        </UInput>
      </UFormField>
      <p class="cursor-pointer">パスワードを忘れた方</p>
      <div class="text-center">
        <UButton type="submit" color="success" size="lg" :disabled="isLoading">ログイン</UButton>
      </div>
    </form>
    <button type="button" class="text-start" @click="submitRegister">新しいアカウントを作成</button>
    <UButton
      icon="i-mdi-github"
      class="mx-4 mt-6 mb-6 h-12 rounded-full bg-black text-white normal-case hover:bg-black/90"
      @click="submitGithub"
    >
      GitHubでログイン
    </UButton>
  </UCard>
</template>
