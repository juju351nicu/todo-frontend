<script setup lang="ts">
import AppHeader from "@/app/layouts/AppHeader.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import { computed } from "vue";

import MemberUpsertConfirm from "@/features/member/components/MemberUpsertConfirm.vue";
import { useMemberDetailPage } from "@/features/member/composables/useMemberDetailPage";

const props = defineProps<{
    id?: number;
}>();

const memberId = computed<number | undefined>(() => props.id);

const {
    clearForm,
    closeConfirm,
    confirmSubmit,
    isLoading,
    isShowConfirm,
    loadError,
    memberForm,
    openConfirm,
    roleItems,
} = useMemberDetailPage(memberId);

</script>
<template>
    <AppHeader />
    <LoadingIndicator v-if="isLoading" />
    <MemberUpsertConfirm v-if="isShowConfirm" :member-form="memberForm" @close-modal="closeConfirm"
        @confirm-submit="confirmSubmit" />
    <v-container>
        <v-alert v-if="loadError" type="error" class="mb-4">
            {{ loadError }}
        </v-alert>
        <v-card width="800px">
            <v-card-title>
                <span> {{ memberForm.memberId > 0 ? memberForm.memberId : ' (新規)' }}</span>
            </v-card-title>
            <v-card-text>
                <v-row>
                    <v-col cols="12" sm="6">
                        <v-text-field name="lastName" v-model="memberForm.lastName" color="purple darken-2" label="姓"
                            placeholder="苗字を入力してください。" required>
                        </v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6">
                        <v-text-field name="firstName" v-model="memberForm.firstName" color="blue darken-2" label="名"
                            placeholder="名前を入力してください。" required>
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-text-field name="loginId" v-model="memberForm.loginId" label="ログインID"
                            placeholder="ログインIDを入力してください。" required>
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-text-field type="password" name="password" v-model="memberForm.password" label="パスワード"
                            :placeholder="memberForm.memberId > 0 ? '変更する場合だけ入力してください。' : 'パスワードを入力してください。'"
                            :required="memberForm.memberId === 0">
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-text-field type="email" name="email" v-model="memberForm.email" label="Email アドレス"
                            placeholder="emailを入力してください。" required>
                        </v-text-field>
                    </v-col>
                    <template v-if="memberForm.role === 0">
                        <v-col cols="12">
                            <v-select name="role" v-model="memberForm.role" :items="roleItems" item-title="roleLabel"
                                item-value="role" label="管理者権限"></v-select>
                        </v-col>
                    </template>
                </v-row>
                <v-btn class="mr-4" color="success" type="button" @click="openConfirm">
                    {{ memberForm.memberId > 0 ? '更新する' : ' 登録する' }}
                </v-btn>
                <v-btn @click="clearForm">
                    クリア
                </v-btn>
            </v-card-text>
        </v-card>
    </v-container>
</template>
