<script setup lang="js">
import { computed, ref } from "vue";
import SideMenu from "@/components/SideMenu.vue";
import Loading from "@/components/Loading.vue";
import { useInquiryStore } from "@/stores/inquiry";


const inquiryStore = useInquiryStore();

const isLoading = computed(() => {
  return inquiryStore.isLoading;
});
const fullName = ref("");
const email = ref("");
const message = ref("");
/** お問い合わせ情報のパラメータを送る */
const submit = (() => {
  const payload = {
    "fullName": fullName.value,
    "email": email.value,
    "message": message.value
  };
  inquiryStore.recieveInquiryInfo(payload);
});
</script>
<template>
  <side-menu />
  <Loading v-if="isLoading" />
  <v-container>
    <v-card width="800px">
      <v-card-title>
        <h4>企業広告等のお問い合わせはこちらからお願いします。</h4>
        <p>
          お問い合わせありがとうございます。<br />
          ご返信までに３～４日頂く場合がございます。
        </p>
      </v-card-title>
      <v-card-text>
        <v-text-field v-model="fullName" label="氏名(必須)" placeholder="お名前" required>
        </v-text-field>
        <v-text-field v-model="email" label="メールアドレス(必須)" placeholder="メールアドレス" required>
        </v-text-field>
        <v-textarea v-model="message" label="お問い合わせ内容(必須)"> </v-textarea>
      </v-card-text>
      <v-btn class="mt-2" color="success" @click="submit" size="large" width="768px">
        送信する
      </v-btn>
    </v-card> </v-container><br />
  <h6>プライバシーポリシー(個人情報に関する基本方針)</h6>
  <p>
    当社では，お客様の個人情報の重要性を認識し適切な収集と利用を図るとともに，個人情報の
    正確性と機密性を確保するため，個人情報保護に関する法令及びその他の規範を遵守，自主的
    なルール・体制を確立し，定めた個人情報保護方針を実行し維持します。
  </p>
</template>
<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
