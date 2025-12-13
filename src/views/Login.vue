<script setup lang="js">
import Alert from "@/components/Alert.vue";
import Loading from "@/components/Loading.vue";
import { ref, onMounted } from 'vue'
import { useUserStore } from "@/stores/user";
import { useRouter } from "vue-router";
import Util from "@/utils/util.js";
import Const from "@/constants/const.js";
/** ルータ情報 */
const router = useRouter();
/** Authストア情報 */
const userStore = useUserStore();
/** ローディングフラグ */
const isLoading = ref(false);
/** モーダルを表示・非表示フラグ */
const isShowModal = ref(false);
const showPassword = ref(false);

const myform = ref({
    loginEmail: '',
    password: ''
});
/**
 * ユーザ新規登録を行う。
 */
const submitRegister = (() => {
    location.href = '/member/upsert?memberId=0';
});
const showMessageModal = () => {
    isShowModal.value = true;
};
const hideMessageModal = () => {
    // モーダルを非表示にする
    isShowModal.value = false;
};
const errorMessages = ref([]);
/**
 * メールアドレスとパスワードでログインする。
 * @returns false
 */
const submitForm = ((event) => {
    // submitイベントの本来の動作を止める
    event.preventDefault();
    const payload = {
        "loginEmail": myform.value.loginEmail,
        "password": myform.value.password
    };
    isLoading.value = true;
    try {
        userStore.authLogin(payload).then(async (response) => {
            if (response.ok) {
                const data = await response.json();
                console.log(data.access_token);
                userStore.setAuthUser(data);
                isLoading.value = false;
                router.push("/member/memberList");
            } else {
                const err = await response.json();
                if (!Util.isEmpty(err.fieldErrors)) {
                    showMessageModal();
                    err.fieldErrors.forEach((fieldError) => {
                        errorMessages.value.push(fieldError.message);
                    });
                    isLoading.value = false;
                }
                throw new Error("There's an error upstream and it says");
            }
        })
    } catch (error) {
        console.log(error);
    } finally {
        errorMessages.value = [];
    };
});
/**
 * Facebookでログインする。
 */
const submitFacebook = (() => {
    location.href = '/oauth2/authorization/facebook';
});
/**
 * Githubでログインする。
 */
const submitGithub = (() => {
    location.href = '/oauth2/authorization/github';
});
/**
 * グーグルでログインする。
 */
const submitGoogle = (() => {
    location.href = '/oauth2/authorization/google';
});
/*
 * ページ開いた時の処理 
 * 1.トークンチェック 
 */
onMounted(() => {
    // トークン取得 
    const token = userStore.accessToken;
    console.log('ページ開いた時の処理:' + token);
    // なければ何もしない
    if (!token) {
        return;
    }
    const checkToken = async () => {
        try {
            // トークンチェックAPI起動  
            const res = await userStore.validateToken(token)
                .then((response) => {
                    console.log(response.status);
                    return response.json();
                })
            // 有効なトークンの場合は自動でTOPページへ
            if (!Util.isEmpty(res.data.username)) {
                // TOPページへ
                console.log('TOPページへ');
                router.push("/member/memberList");
            } else {
                // 有効でない場合はトークンを除去    
                userStore.setAccessToken("");
            }
        } catch (err) {
            // 予期せぬエラーでもトークンを除去しログインしてもらう   
            userStore.setAccessToken("");
        }
    };
    // トークンチェック処理開始 
    checkToken();
}) 
</script>
<template>
    <Loading v-if="isLoading" />
    <template v-if="isShowModal">
        <div v-for="(message, index) in errorMessages" :key="index">
            <div class="d-flex justify-end">
                <Alert class="mx-4" :message="message" :type=Const.ALERT_TYPE.ERROR />
            </div>
        </div>
    </template>
    <v-card class="d-flex flex-column mx-auto mt-9 flat" width="374" color="#fff">
        <v-card-title class="d-flex justify-center pa-0 mt-6">ログイン</v-card-title>
        <v-card-text class="d-flex justify-center flex-column">
            <p class="text-center pt-3 mt-3 text-subtitle-1 siginIn-border-top">
                メールアドレスでログイン
            </p>
            <form class="mx-9" ref="form" :model="myform">
                <v-text-field prepend-inner-icon="mdi-email" name="loginEmail" type="email" v-model="myform.loginEmail"
                    placeholder="メールアドレス" outlined dense>
                </v-text-field>
                <v-text-field prepend-inner-icon="mdi-lock" name="password"
                    v-bind:type="showPassword ? 'text' : 'password'" @click:append-inner="showPassword = !showPassword"
                    v-bind:append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'" v-model="myform.password"
                    placeholder="パスワード" outlined dense>
                </v-text-field>
                <p class="pointer">パスワードを忘れた方</p>
                <div class="text-center">
                    <v-btn color="success" size="large" variant="elevated" @click="submitForm($event)">ログイン</v-btn>
                </div>
            </form>
            <p @click="submitRegister">新しいアカウントを作成</p>
            <v-btn prepend-icon="mdi-facebook" class="fill-width mt-6 text-capitalize white--text caption mx-4" rounded
                color="#3b5998" depressed height="48px" @click="submitFacebook">
                Facebookでログイン
            </v-btn>
            <v-btn prepend-icon="mdi-google" class="fill-width mt-6 text-capitalize text--white caption mx-4" rounded
                height="48px" outlined color="red" @click="submitGoogle">
                Googleでログイン
            </v-btn>
            <v-btn prepend-icon="mdi-github" class="fill-width mt-6 text-capitalize text--white caption mx-4 mb-6"
                rounded height="48px" outlined color="black" @click="submitGithub">
                Githubでログイン
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