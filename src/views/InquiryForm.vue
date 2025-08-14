<template>
  <side-menu />
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
        <v-text-field
          v-model="email"
          label="メールアドレス(必須)"
          placeholder="メールアドレス"
          required
        >
        </v-text-field>
        <v-textarea v-model="message" label="お問い合わせ内容(必須)"> </v-textarea>
      </v-card-text>
      <v-btn class="mt-2" color="success" @click="submit" size="large" width="768px">
        送信する
      </v-btn>
    </v-card> </v-container
  ><br />
  <h6>プライバシーポリシー(個人情報に関する基本方針)</h6>
  <p>
    当社では，お客様の個人情報の重要性を認識し適切な収集と利用を図るとともに，個人情報の
    正確性と機密性を確保するため，個人情報保護に関する法令及びその他の規範を遵守，自主的
    なルール・体制を確立し，定めた個人情報保護方針を実行し維持します。
  </p>
</template>
<script>
import SideMenu from "../components/SideMenu.vue";
export default {
  name: "InquiryForm",
  components: { SideMenu },
  data() {
    return {
      drawer: false,
      group: null,
      fullName: "",
      email: "",
      message: "",
      links: [
        { icon: "mdi-home", text: "Home", url: "" },
        {
          icon: "mdi-account",
          text: "アカウント",
          url: "/member/upsert?memberId=" + 1,
        },
        { icon: "mdi-format-list-bulleted", text: "お知らせ一覧", url: "../news/list" },
        { icon: "mdi-view-dashboard", text: "ダッシュボード画面", url: "/todo/Top" },
        { icon: "mdi-account-cancel", text: "退会", url: "/member/cancel" },
        { icon: "mdi-export", text: "ログアウト", url: "/logout" },
      ],
      hoverFlag: false,
      role: 0,
    };
  },
  mounted() {
    if (this.role == 0) {
      this.links.push(
        {
          icon: "mdi-account-plus",
          text: "会員新規登録",
          url: "../member/upsert?memberId=0",
        },
        {
          icon: "mdi-bell-plus",
          text: "お知らせ新規登録",
          url: "../news/upsert?newsId=0",
        }
      );
    }
    if (this.role == 0 || this.role == 1) {
      this.links.push({
        icon: "mdi-account-multiple",
        text: "会員一覧",
        url: "../member/list",
      });
    }
  },
  methods: {
    /**
     * お問い合わせ情報のパラメータを送る
     */
    submit() {
      let formData = new FormData();
      formData.set("fullName", this.fullName);
      formData.set("email", this.email);
      formData.set("message", this.message);
      fetch("http://localhost:8030/inquiryForm/sendmail", {
        method: "POST",
        body: formData,
      })
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          console.log(data);
        })
        .catch((error) => {
          console.log(error);
        });
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
