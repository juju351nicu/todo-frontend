<template>
    <div style="text-align:center;">
        <h2>予約一覧確認ログイン</h2>
        <br>
        </br>
        <p v-if="error">{{ error }}</p>
        <table style="margin: 0 auto;">
            <tbody>
                <tr>
                    <th>ユーザID</th>
                    <td>
                        <TextParts v-model="username" custom-class="input_username"></TextParts>
                    </td>
                </tr>
                <tr>
                    <th>パスワード</th>
                    <td>
                        <TextParts v-model="password" custom-class="input_username" type="password">
                        </TextParts>
                    </td>
                </tr>
                <tr>
                    <td colspan="2">
                        <div style="padding-top:10px;padding-bottom:10px;">
                            <button class="button-design" @click="submitForm()">
                                <span>ログイン</span>
                            </button>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
<script setup lang="js">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router';
import TextParts from './TextParts.vue'
import yoyakuTableApi from '../api/yoyakuTableApi'
import { logout } from '@/const/common'
const username = ref('');
// ユーザ名
const password = ref('');
// パスワード(平文) 
const error = ref('');
// エラーメッセージ
const router = useRouter()
// ルーティング
/** * 認証処理 */
const submitForm = async () => {
    // リクエストDTO設定    
    const dto = { username: username.value, password: password.value };
    try {
        // 認証(サーバ)      
        const res = await yoyakuTableApi.authLogin(dto);
        // 認証が問題なければTokenをlocalStorageで保持    
        localStorage.setItem("accessToken", res.data.accessToken)
        // 予約確認画面へ遷移   
        router.push('/YoyakuKakunin');
    } catch (err) {
        // エラー時処理       
        if (err.response) {
            // レスポンスがあれば判定           
            if (err.response.status === 401) {
                // 401は認証エラー            
                error.value = "Tokenエラーです。もう一度ログインしてください。"
                localStorage.removeItem("accessToken");
            } else {
                // それ以外は認証失敗           
                error.value = `ログイン失敗 (${err.response.status})`
            }
        } else {
            // 予期せぬエラー(サーバやミドルが立ち上がってない時など)       
            error.value = "ネットワークエラーです"
        }
    }
}
/* * ページ開いた時の処理 * 1.トークンチェック */
onMounted(() => {
    // トークン取得 
    const token = localStorage.getItem("accessToken");
    // なければ何もしない
    if (!token)
        return;
    const checkToken = async () => {
        try {
            // トークンチェックAPI起動  
            const res = await yoyakuTableApi.validateToken(token);
            // 有効なトークンの場合は自動でTOPページへ
            if (res.data.valid) {
                // 予約一覧ページへ        
                router.push("/YoyakuKakunin");
            } else {
                // 有効でない場合はトークンを除去    
                localStorage.removeItem("accessToken");
            }
        } catch (err) {
            // 予期せぬエラーでもトークンを除去しログインしてもらう   
            localStorage.removeItem("accessToken");
        }
    };
    // トークンチェック処理開始 
    checkToken();
}) 
</script>
