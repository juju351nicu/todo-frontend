<template>
    <v-container>
        <v-card width="800px">
            <v-card-title>
                <span> {{ myform.todoId > 0 ? myform.todoId : ' (新規)' }}</span>
            </v-card-title>
            <span th:if="${#fields.hasErrors('todoId')}" th:errors="*{todoId}" th:errorclass="err"></span>
            <v-card-text>
                <form ref="form" :model="myform">
                    <v-row>
                        <template v-if="myform.todoId == 0 && role == 0">
                            <v-col cols="12">
                                <v-select name="userId" v-model="myform.userId" :items="fullNameItems"
                                    item-title="userObjLabel" item-value="userObjId" label="対象ユーザ"></v-select>
                            </v-col>
                        </template>
                        <!-- <template v-if="myform.id > 0 && role == 0"> 2月3日削除 -->
                        <template v-if="myform.todoId > 0">
                            <v-col cols="12">
                                <v-text-field>{{ fullName }}
                                </v-text-field>
                            </v-col>
                            <input type="hidden" name="userId" ref="inputUserId">
                        </template>
                        <template v-if="myform.todoId == 0">
                            <input type="hidden" name="userId" ref="inputUserId">
                        </template>
                        <span th:if="${#fields.hasErrors('userId')}" th:errors="*{userId}"
                            th:errorclass="err">errorMessage</span>
                        <v-col cols="12">
                            <v-text-field name="dateFrom" v-model="myform.dateFrom" label="着手日" required>
                            </v-text-field>
                        </v-col>
                        <v-col cols="12">
                            <v-text-field name="dateTo" v-model="myform.dateTo" label="期限日" required>
                            </v-text-field>
                        </v-col>
                        <span th:if="${#fields.hasErrors('dateFrom')}" th:errors="*{dateFrom}"
                            th:errorclass="err">errorMessage</span>
                        <span th:if="${#fields.hasErrors('dateTo')}" th:errors="*{dateTo}"
                            th:errorclass="err">errorMessage</span>
                        <v-col cols="12">
                            <v-select name="priority" v-model="myform.priority" :items="priorityItems"
                                item-title="priorityLabel" item-value="priority" label="重要度"></v-select>
                        </v-col>
                        <v-col cols="12">
                            <v-select name="doneFlag" v-model="myform.doneFlag" :items="doneFlagItems"
                                item-title="doneFlagLabel" item-value="doneFlag" label="完了フラグ"></v-select>
                        </v-col>
                        <v-col cols="12">
                            <v-text-field name="title" v-model="myform.title" label="タイトル" required>
                            </v-text-field>
                        </v-col>
                        <span th:if="${#fields.hasErrors('title')}" th:errors="*{title}"
                            th:errorclass="err">errorMessage</span>
                        <v-col cols="12">
                            <v-textarea name="detail" v-model="myform.detail" label="詳細" required>
                            </v-textarea>
                        </v-col>
                        <span th:if="${#fields.hasErrors('detail')}" th:errors="*{detail}"
                            th:errorclass="err">errorMessage</span>
                        <span th:if="${#fields.hasErrors('priority')}" th:errors="*{priority}"
                            th:errorclass="err">errorMessage</span>
                        <span th:if="${#fields.hasErrors('doneFlag')}" th:errors="*{doneFlag}"
                            th:errorclass="err">errorMessage</span>
                        <span th:if="${#fields.hasErrors('version')}" th:errors="*{version}"
                            th:errorclass="err">errorMessage</span>
                        <input type="hidden" name="todoId" :value="myform.todoId">
                        <input type="hidden" name="version" :value="myform.version">
                        <v-btn class="mr-4" color="success" type="submit" @click="formSubmit">
                            更新する
                        </v-btn>
                        <v-btn>
                            クリア
                        </v-btn>
                    </v-row>
                </form>
            </v-card-text>
        </v-card>
    </v-container>
</template>
<script>
export default {
    name: "TodoDetail",
    data() {
        return {
            myform: {
                todoId: 0,
                dateFrom: "",
                dateTo: "",
                title: "",
                detail: "",
                userId: 0,
                doneFlag: false,
                priority: 0,
                version: 0,
                idMemberMap: [],
                userList: []
            },
            role: 0,
            priorityItems: [
                { priorityLabel: '低', priority: 1 },
                { priorityLabel: '中', priority: 2 },
                { priorityLabel: '高', priority: 3 },],
            doneFlagItems: [
                { doneFlagLabel: '未完了', doneFlag: 0 },
                { doneFlagLabel: '完了', doneFlag: 1 },],
            fullNameItems: [
                { userObjLabel: '全員', userObjId: -1 }
            ]
        }
    },
    mounted() {
        console.log('priority' + (this.myform.priority == 0));
        console.log('doneFlag' + (this.myform.doneFlag == false) + '値' + this.myform.doneFlag);
        console.log('判定結果:' + (this.myform.userId in this.myform.idMemberMap));
        if (this.myform.doneFlag == null || this.myform.doneFlag == 'false') {
            this.myform.doneFlag = { doneFlagLabel: '未完了', doneFlag: 0 };
        };
        if (this.myform.priority == 0) {
            this.myform.priority = { priorityLabel: '低', priority: 1 }
        };
        if (role == 0 && this.myform.todoId == 0) {
            for (let i = 0; i < this.myform.userList.length; i++) {
                this.fullNameItems.push({
                    userObjLabel: this.myform.userList[i].lastName + this.myform.userList[i].firstName,
                    userObjId: this.myform.userList[i].id
                })
            }
        }
    },
    computed: {
        /**
         * 
         * @returns 
         */
        fullName() {
            return (this.myform.userId in this.myform.idMemberMap) ? this.myform.idMemberMap[this.myform.userId].lastName + this.myform.idMemberMap[this.myform.userId].firstName : '削除されたユーザ';
        }
    },
    methods: {
        /**
         * 
         * @returns 
         */
        formSubmit() {
            this.$refs.form.value = this.myform.todoId;
            this.$refs.form.value = this.myform.dateFrom;
            this.$refs.form.value = this.myform.dateTo;
            this.$refs.form.value = this.myform.title;
            this.$refs.form.value = this.myform.detail;
            if (role == 0) {
                if (this.myform.todoId == 0) {
                    this.$refs.form.value = this.myform.userId;
                } else {
                    this.$refs.inputUserId.value = this.myform.userId;
                }
            } else {
                this.$refs.inputUserId.value = this.sessionUserId;
            }
            this.$refs.form.value = this.myform.doneFlag;
            this.$refs.form.value = this.myform.priority;
            this.$refs.form.value = this.myform.version;
            this.$refs.form.method = 'POST';
            this.$refs.form.action = '/todo/upsert';
            this.$refs.form.submit();
            return false;
        }
    }
};
</script>