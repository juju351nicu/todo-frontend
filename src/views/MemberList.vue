<template>
    <side-menu />
    <Loading v-if="isLoading" />
    <h2>会員一覧</h2>
    <v-data-table density="compact" show-select v-model="selected" v-model:items-per-page="itemsPerPage"
        item-value="memberId" :headers="headers" :items="memberList" :items-per-page-options="pages"
        items-per-page-text="表示行数" class="elevation-1">
        <template v-slot:item.actions="{ item }">
            <v-icon size="small" class="me-2" @click="showUpsert(item)"> mdi-pencil </v-icon>
        </template>
    </v-data-table>
    <div>{{ selected }}</div>
    <form ref="form">
        <input type="hidden" name="ids" ref="inputIds">
        <v-btn prepend-icon="mdi-delete" class="mr-4" color="success" @click="formSubmit()"> 削除確認する </v-btn>
    </form>
</template>
<script>
import SideMenu from "@/components/SideMenu.vue";
import Loading from "@/components/Loading.vue";
export default {
    name: "memberList",
    data() {
        return {
            memberList: [],
            memberId: "user01",
            // selected: ids
            selected: [],
            itemsPerPage: 5,
            pages: [
                { value: 5, title: "5" },
                { value: 10, title: "10" },
                { value: 20, title: "20" },
                { value: -1, title: "$vuetify.dataFooter.itemsPerPageAll" },
            ],
            headers: [
                {
                    title: "ID",
                    align: "start",
                    sortable: false,
                    key: "memberId",
                },
                { title: "氏名", align: "start", key: "lastName" },
                { title: "ログインID", align: "start", key: "loginId" },
                { title: "パスワード", align: "start", key: "password" },
                { title: "登録日", align: "start", key: "registeredDate" },
                { title: "更新日", align: "start", key: "updatedDate" },
                { title: "最終ログインした時刻", align: "start", key: "lastLogin" },
                { title: "編集", align: "start", key: "actions" },
            ],
        };
    },
    methods: {
        /**
         * チェックボックスクリック時に配列に会員ID情報を格納する。
         * @param {*} id
         */
        pushCheckIds(id) {
            console.log("id:" + id);
            this.ids.push(id);
            console.log("ids.length:" + this.ids);
        },
        /**
         * 削除ボタン押下の際に確認画面に遷移する。
         * @param {*} ids チェックボックスで選択したidの配列
         * @returns false
         */
        formSubmit() {
            this.$refs.inputIds.name = "ids";
            this.$refs.inputIds.value = this.selected;
            this.$refs.form.method = "POST";
            this.$refs.form.action = "/member/check";
            this.$refs.form.submit();
            return false;
        },
        clickRow() {
            //vuetify3 clickRowで時間あるときに検索
            console.log("currentRowReactive");
        },
        /**
         * 更新画面に遷移する
         * @param {*} item 行情報
         */
        showUpsert(item) {
            location.href = "/member/upsert?memberId=" + item.memberId;
        },
    },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>