<script setup lang="ts">
import AppAlert from "@/shared/components/AppAlert.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import { onMounted } from "vue";

import Const from "@/constants/const";
import { useLoginPage } from "@/features/auth/composables/useLoginPage";

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
        <div v-for="(message, index) in errorMessages" :key="index">
            <div class="d-flex justify-end">
                <AppAlert class="mx-4" :message="message" :type=Const.ALERT_TYPE.ERROR />
            </div>
        </div>
    </template>
    <v-card class="d-flex flex-column mx-auto mt-9 flat" width="374" color="#fff">
        <v-card-title class="d-flex justify-center pa-0 mt-6">ログイン</v-card-title>
        <v-card-text class="d-flex justify-center flex-column">
            <p class="text-center pt-3 mt-3 text-subtitle-1 siginIn-border-top">
                ログインIDでログイン
            </p>
            <form class="mx-9" @submit.prevent="submitForm">
                <v-text-field prepend-inner-icon="mdi-account" name="loginId" type="text" v-model="loginForm.loginId"
                    placeholder="ログインID" autocomplete="username" outlined dense>
                </v-text-field>
                <v-text-field prepend-inner-icon="mdi-lock" name="password"
                    v-bind:type="showPassword ? 'text' : 'password'" @click:append-inner="showPassword = !showPassword"
                    v-bind:append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'" v-model="loginForm.password"
                    placeholder="パスワード" outlined dense>
                </v-text-field>
                <p class="pointer">パスワードを忘れた方</p>
                <div class="text-center">
                    <v-btn type="submit" color="success" size="large" variant="elevated">ログイン</v-btn>
                </div>
            </form>
            <p @click="submitRegister">新しいアカウントを作成</p>
            <v-btn prepend-icon="mdi-github" class="fill-width mt-6 text-capitalize text--white caption mx-4 mb-6"
                rounded height="48px" outlined color="black" @click="submitGithub">
                GitHubでログイン
            </v-btn>
        </v-card-text>
    </v-card>
</template>
<style scoped>
body {
    background: purple;
}

html,
body {
    /* margin-top: 200px; */
    position: relative;
    height: 100%;
}

.login-container {
    position: relative;
    width: 350px;
    margin: 80px auto;
    padding: 20px 40px 40px;
    text-align: center;
    background: #fff;
    border: 1px solid #ccc;
}

#output {
    position: absolute;
    width: 300px;
    top: -75px;
    left: 0;
    color: #fff;
}

#output.alert-success {
    background: rgb(25, 204, 25);
}

#output.alert-danger {
    background: rgb(228, 105, 105);
}


.login-container::before,
.login-container::after {
    content: "";
    position: absolute;
    width: 100%;
    height: 100%;
    top: 3.5px;
    left: 0;
    background: #fff;
    z-index: -1;
    border: 1px solid #ccc;

}

.login-container::after {
    top: 5px;
    z-index: -2;
}

.avatar {
    width: 100px;
    height: 100px;
    margin: 10px auto 30px;
    border-radius: 100%;
    border: 2px solid #aaa;
    background-size: cover;
}

.form-box input {
    width: 100%;
    padding: 10px;
    text-align: center;
    height: 40px;
    border: 1px solid #ccc;
    ;
    background: #fafafa;
    transition: 0.2s ease-in-out;

}

.form-box input:focus {
    outline: 0;
    background: #eee;
}

.form-box input[type="email"] {
    border-radius: 5px 5px 0 0;
    text-transform: lowercase;
}

.form-box input[type="password"] {
    border-radius: 0 0 5px 5px;
    border-top: 0;
}

.form-box button.login {
    margin-top: 15px;
    padding: 10px 20px;
}

.animated {
    -webkit-animation-duration: 1s;
    animation-duration: 1s;
    -webkit-animation-fill-mode: both;
    animation-fill-mode: both;
}

@-webkit-keyframes fadeInUp {
    0% {
        opacity: 0;
        -webkit-transform: translateY(20px);
        transform: translateY(20px);
    }

    100% {
        opacity: 1;
        -webkit-transform: translateY(0);
        transform: translateY(0);
    }
}

@keyframes fadeInUp {
    0% {
        opacity: 0;
        -webkit-transform: translateY(20px);
        -ms-transform: translateY(20px);
        transform: translateY(20px);
    }

    100% {
        opacity: 1;
        -webkit-transform: translateY(0);
        -ms-transform: translateY(0);
        transform: translateY(0);
    }
}

.fadeInUp {
    -webkit-animation-name: fadeInUp;
    animation-name: fadeInUp;
}
</style>
