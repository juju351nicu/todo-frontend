<script setup lang="ts">
import TheHeader from "@/components/TheHeader.vue";
import UpsertConfirm from "@/components/member/UpsertConfirm.vue";
import Loading from "@/components/Loading.vue";
import { computed, reactive, ref, watch } from "vue";

import { useMemberStore } from "@/stores/member";
import type { AccountRole, MemberUpsertRequest } from "@/types/member";
import { createMemberDetailForm, type MemberDetailForm } from "@/utils/detail";

interface RoleItem {
    roleLabel: string;
    role: AccountRole;
}

const props = defineProps<{
    id?: number;
}>();

/** 会員ストア情報 */
const memberStore = useMemberStore();

/** ローディングフラグ */
const isLoading = computed<boolean>(() => {
    return memberStore.isLoading;
});

/** URLから受け取った会員ID */
const numId = computed<number>(() => {
    const id = props.id ?? 0;
    return Number.isInteger(id) && id > 0 ? id : 0;
});

/** 会員編集フォーム */
const myform = reactive<MemberDetailForm>(createMemberDetailForm());

/** 詳細取得エラー */
const loadError = ref("");

/**
 * 会員詳細をAPIから取得してフォームを復元する。
 * 新規登録（ID=0）の場合は初期値のまま表示する。
 */
const loadMemberDetail = async (): Promise<void> => {
    Object.assign(myform, createMemberDetailForm());
    loadError.value = "";
    if (numId.value === 0) {
        return;
    }

    try {
        const detail = await memberStore.findMemberDetail(numId.value);
        Object.assign(myform, createMemberDetailForm(detail));
    } catch (error) {
        console.error(error);
        loadError.value = "会員情報を取得できませんでした。会員一覧から開き直してください。";
    }
};

watch(numId, () => {
    void loadMemberDetail();
}, { immediate: true });

const roleItems: RoleItem[] = [
    { roleLabel: "管理者", role: 0 },
    { roleLabel: "閲覧管理者", role: 1 },
    { roleLabel: "ユーザ", role: 2 },
];

/** モーダルを表示・非表示フラグ */
const isShowModal = ref(false);

/** 確認画面「モーダル」を表示する */
const showModal = (): void => {
    isShowModal.value = true;
};

/**
 * モーダルを非表示にする
 */
const handleCloseModal = (): void => {
    isShowModal.value = false;
};

/**
 * 会員情報を新規登録・更新する。
 */
const confirmSubmit = async (): Promise<void> => {
    isShowModal.value = false;
    const payload: MemberUpsertRequest = {
        memberId: myform.memberId,
        lastName: myform.lastName,
        firstName: myform.firstName,
        loginId: myform.loginId,
        password: myform.password,
        email: myform.email,
        role: myform.role,
        version: myform.version,
    };
    await memberStore.upsertMemberInfo(payload);
};

</script>
<template>
    <TheHeader />
    <Loading v-if="isLoading" />
    <UpsertConfirm v-if="isShowModal" :myform="myform" @close-modal="handleCloseModal"
        @confirm-submit="confirmSubmit" />
    <v-container>
        <v-alert v-if="loadError" type="error" class="mb-4">
            {{ loadError }}
        </v-alert>
        <v-card width="800px">
            <v-card-title>
                <span> {{ myform.memberId > 0 ? myform.memberId : ' (新規)' }}</span>
            </v-card-title>
            <v-card-text>
                <v-row>
                    <v-col cols="12" sm="6">
                        <v-text-field name="lastName" v-model="myform.lastName" color="purple darken-2" label="姓"
                            placeholder="苗字を入力してください。" required>
                        </v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6">
                        <v-text-field name="firstName" v-model="myform.firstName" color="blue darken-2" label="名"
                            placeholder="名前を入力してください。" required>
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-text-field name="loginId" v-model="myform.loginId" label="ログインID"
                            placeholder="ログインIDを入力してください。" required>
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-text-field type="password" name="password" v-model="myform.password" label="パスワード"
                            :placeholder="myform.memberId > 0 ? '変更する場合だけ入力してください。' : 'パスワードを入力してください。'"
                            :required="myform.memberId === 0">
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-text-field type="email" name="email" v-model="myform.email" label="Email アドレス"
                            placeholder="emailを入力してください。" required>
                        </v-text-field>
                    </v-col>
                    <template v-if="myform.role === 0">
                        <v-col cols="12">
                            <v-select name="role" v-model="myform.role" :items="roleItems" item-title="roleLabel"
                                item-value="role" label="管理者権限"></v-select>
                        </v-col>
                    </template>
                </v-row>
                <v-btn class="mr-4" color="success" type="button" @click="showModal">
                    {{ myform.memberId > 0 ? '更新する' : ' 登録する' }}
                </v-btn>
                <v-btn>
                    クリア
                </v-btn>
            </v-card-text>
        </v-card>
    </v-container>
</template>
