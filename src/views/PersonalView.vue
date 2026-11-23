<script setup lang="ts">
// ユーザー情報更新(旧 (admin)/personal/page.tsx)
//
// 【YouTube連携について】
// バックエンドのYouTube連携API(/youtube/status, /youtube/authorize-url,
// /youtube/callback, /youtube/unlink)実装済み。未連携なら「YouTubeと連携」でGoogle同意画面へ画面遷移し、
// 連携済みなら「連携を解除」(確認のうえ)で解除する。
//
// 画面は Vuetify の v-card で、「基本情報」「セキュリティ」「YouTube連携」をそれぞれ1枚のカードにし、
// 最後のフッター(v-card-actions)に「廃棄」「更新」を右寄せで置く。
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { storeToRefs } from "pinia";
import api from "@/api/axios";
import { useFeedbackStore } from "@/stores/feedback";
import { useAuthStore } from "@/stores/auth";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { useDuplicateCheck } from "@/composables/useDuplicateCheck";
import { useUnsavedGuard } from "@/stores/unsavedGuard";
import { confirmDiscardUnsaved } from "@/router/guards";
import { EMPTY_STRING, extractMessage } from "@/lib/constants";
import { required } from "@/lib/form";
import "@/plugins/fonts/serif"; // タイトルの明朝体(Noto Serif JP の太字)
import PageBackground from "@/components/PageBackground.vue";
import backgroundImage from "@/assets/mainmenu-bg4.webp?no-inline";

type StudentForm = {
  id: string | null;
  loginAccount: string;
  username: string;
  password: string;
  dateOfBirth: string;
  email: string;
};
type Editable = Omit<StudentForm, "id">;
/** GET /students/{id} の応答(password は常に固定のマスク値) */
type StudentDetail = Editable;

const emptyForm: StudentForm = {
  id: null,
  loginAccount: EMPTY_STRING,
  username: EMPTY_STRING,
  password: EMPTY_STRING,
  dateOfBirth: EMPTY_STRING,
  email: EMPTY_STRING,
};

const studentKey = (id: string | null) => ["students", id ?? ""] as const;
const YOUTUBE_STATUS_KEY = ["youtube", "status"] as const;

const toDateInputValue = (src: string) => {
  if (!src) return EMPTY_STRING;
  if (/^\d{4}-\d{2}-\d{2}$/.test(src)) return src;
  const d = new Date(src);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const route = useRoute();
const router = useRouter();
const feedback = useFeedbackStore();
const queryClient = useQueryClient();
// 編集対象は常にログイン中のユーザー本人。URLの userId は信用しない
const { userId: authUserId } = storeToRefs(useAuthStore());
const userId = computed(() => authUserId.value || null);

// ===== ユーザー情報 =====
// 他の人(別端末)の更新を拾えるよう開くたびに取り直すが、編集中には取り直さない
const studentQuery = useQuery(
  computed(() => ({
    queryKey: studentKey(userId.value),
    queryFn: async (): Promise<StudentForm> => {
      const { data } = await api.get<StudentDetail>(
        `/students/${userId.value}`,
      );
      return {
        id: userId.value,
        loginAccount: data.loginAccount,
        username: data.username,
        password: data.password,
        dateOfBirth: toDateInputValue(data.dateOfBirth),
        email: data.email,
      };
    },
    enabled: !!userId.value,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })),
);
watch(studentQuery.error, (e) => {
  if (e) feedback.toast(extractMessage(e, "データの取得に失敗しました"));
});

// ユーザーが入力した分だけを持ち、画面に出す値は「読み込んだ内容 + 入力」で作る
const edits = reactive<Partial<Editable>>({});
const saved = ref(false);
const form = computed<StudentForm>(() => ({
  ...(studentQuery.data.value ?? { ...emptyForm, id: userId.value }),
  ...edits,
}));
const field = <K extends keyof Editable>(key: K) =>
  computed<string>({
    get: () => form.value[key],
    set: (v) => {
      saved.value = false;
      edits[key] = v;
    },
  });
const loginAccount = field("loginAccount");
const username = field("username");
const password = field("password");
const dateOfBirth = field("dateOfBirth");
const email = field("email");
const isDirty = computed(
  () =>
    !saved.value &&
    (Object.keys(edits) as (keyof Editable)[]).some(
      (key) => form.value[key] !== (studentQuery.data.value ?? emptyForm)[key],
    ),
);
useUnsavedChanges(isDirty);

const emptyErrors = () => ({
  loginAccount: EMPTY_STRING,
  username: EMPTY_STRING,
  password: EMPTY_STRING,
  dateOfBirth: EMPTY_STRING,
  email: EMPTY_STRING,
});
const errors = reactive(emptyErrors());
const showPassword = ref(false);

// ===== YouTube連携 =====
// 未連携なら「YouTubeと連携」、連携済みなら「連携を解除」のボタンを1つだけ出す
const youtubeQuery = useQuery(
  computed(() => ({
    queryKey: YOUTUBE_STATUS_KEY,
    queryFn: async () =>
      !!(await api.get<{ linked: boolean }>("/youtube/status")).data.linked,
    enabled: !!userId.value,
    // 未ログイン等はルーターの認証チェックに任せ、ここでは静かに無視する
    retry: false,
  })),
);
const youtubeLinked = computed(() => youtubeQuery.data.value ?? false);

const unlinkMutation = useMutation({
  mutationFn: () => api.post("/youtube/unlink"),
  onSuccess: () => {
    queryClient.setQueryData(YOUTUBE_STATUS_KEY, false);
    feedback.toast("YouTube連携を解除しました");
  },
  onError: (e) => feedback.toast(extractMessage(e, "連携解除に失敗しました")),
});
const youtubeBusy = unlinkMutation.isPending;

const onYoutubeUnlink = async () => {
  const ok = await feedback.confirm(
    "YouTube連携を解除しますか。プレイリストを作成するには、もう一度連携が必要です。",
    "警告",
  );
  if (ok) unlinkMutation.mutate();
};

const onYoutubeConnect = async () => {
  if (!(await confirmDiscardUnsaved())) return;
  // 破棄に同意済みなので、通常のページ遷移で二重に確認しない。
  useUnsavedGuard().setBypass();
  // 連携開始はバックエンドが直接Google同意画面へリダイレクトするため、
  // XHR やルーターの遷移ではなく、ブラウザの通常の画面遷移にする。
  window.location.href = "/api/youtube/authorize-url";
};

// Google の同意画面から ?youtube=... 付きで戻ってきたときの結果表示(1回だけ)
onMounted(() => {
  const youtubeStatus = route.query.youtube;
  if (typeof youtubeStatus !== "string" || !youtubeStatus) return;
  const messages: Record<string, string> = {
    connected: "YouTubeと連携しました",
    error: "YouTube連携に失敗しました",
    invalid_state: "不正なリクエストです。もう一度お試しください。",
    unauthorized: "ログインが必要です",
  };
  feedback.toast(messages[youtubeStatus] ?? "YouTube連携の処理が完了しました");
  // ?youtube=... だけを消してURLをきれいにする(再読み込みで再表示させない)
  void router.replace("/personal");
});

const accountCheck = useDuplicateCheck({
  value: () => form.value.loginAccount.trim(),
  request: (name, signal) =>
    api.get("/students/duplicate-check", {
      params: { id: form.value.id ?? EMPTY_STRING, loginAccount: name },
      signal,
    }),
  duplicateMessage: "このアカウントは既に使われています。",
  failureMessage:
    "アカウントの重複確認に失敗しました。もう一度お試しください。",
});
const checkAccount = accountCheck.check;
watch(loginAccount, () => {
  errors.loginAccount = EMPTY_STRING;
});

const updateMutation = useMutation({
  mutationFn: async (f: StudentForm) =>
    (
      await api.put(`/students/${f.id}`, {
        id: f.id,
        loginAccount: f.loginAccount.trim(),
        username: f.username.trim(),
        password: f.password,
        email: f.email,
        dateOfBirth: f.dateOfBirth,
      })
    ).data as unknown,
  onSuccess: async (data) => {
    saved.value = true;
    await nextTick(); // 未保存ガードが解除されてから移動する
    // 次に開いたとき、更新後の内容を読み込み直す
    void queryClient.invalidateQueries({ queryKey: studentKey(userId.value) });
    feedback.toast(typeof data === "string" ? data : "更新しました");
    void router.push("/mainmenu");
  },
  onError: (e) => feedback.toast(extractMessage(e, "更新に失敗しました")),
});
const validating = ref(false);
const saving = computed(
  () => validating.value || updateMutation.isPending.value,
);

const onUpdate = async () => {
  if (saving.value) return;
  const f = form.value;
  Object.assign(errors, {
    loginAccount: required(f.loginAccount),
    username: required(f.username),
    password: required(f.password),
    dateOfBirth: required(f.dateOfBirth),
    email: required(f.email),
  });
  if (Object.values(errors).some(Boolean)) {
    feedback.toast("入力情報不正");
    return;
  }
  validating.value = true;
  try {
    if (await accountCheck.check()) await updateMutation.mutateAsync(f);
  } catch {
    // 更新失敗の通知は mutation の onError が行う
  } finally {
    validating.value = false;
  }
};

// 入力を捨てて、サーバーの最新の内容を読み込み直す
const onRestore = () => {
  if (saving.value) return;
  saved.value = false;
  accountCheck.reset();
  Object.assign(errors, emptyErrors());
  for (const k of Object.keys(edits) as (keyof Editable)[]) delete edits[k];
  if (userId.value) void studentQuery.refetch();
};

/** 入力欄の共通設定(Vuetify の outlined。ラベルは欄の中にあり、入力・フォーカスで枠の上へ移る) */
const inputProps = computed(
  () =>
    ({
      variant: "outlined",
      color: "primary",
      "hide-details": "auto",
      disabled: saving.value,
    }) as const,
);
</script>

<template>
  <div class="personal">
    <PageBackground :src="backgroundImage" />

    <v-breadcrumbs
      class="personal__breadcrumbs"
      :items="[
        { title: 'メインメニュー', to: '/mainmenu' },
        { title: 'ユーザー情報', disabled: true },
      ]"
    />

    <v-card rounded="lg" class="personal__card">
      <v-card-item
        prepend-icon="mdi-card-account-details-outline"
        class="bg-info on-sidebar"
      >
        <v-card-title tag="h1" class="text-title-large personal__title">
          ユーザー情報更新
        </v-card-title>
      </v-card-item>

      <v-card-text class="personal__body">
        <!-- ===== 基本情報 ===== -->
        <v-card
          variant="outlined"
          prepend-icon="mdi-account-outline"
          title="基本情報"
          subtitle="ログインと画面の表示に使う情報"
          class="personal__section"
        >
          <v-card-text>
            <v-row density="compact">
              <v-col cols="12" sm="6">
                <v-text-field
                  id="personal-account"
                  v-model="loginAccount"
                  v-bind="inputProps"
                  label="アカウント"
                  autocomplete="username"
                  :error-messages="
                    errors.loginAccount || accountCheck.error.value || undefined
                  "
                  @blur="checkAccount"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  id="personal-username"
                  v-model="username"
                  v-bind="inputProps"
                  label="名称"
                  :error-messages="errors.username || undefined"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  id="personal-email"
                  v-model="email"
                  v-bind="inputProps"
                  label="メール"
                  type="email"
                  autocomplete="email"
                  :error-messages="errors.email || undefined"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  id="personal-dob"
                  v-model="dateOfBirth"
                  v-bind="inputProps"
                  label="生年月日"
                  type="date"
                  :error-messages="errors.dateOfBirth || undefined"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- ===== セキュリティ ===== -->
        <v-card
          variant="outlined"
          prepend-icon="mdi-lock-outline"
          title="セキュリティ"
          subtitle="ログインに使うパスワード"
          class="personal__section"
        >
          <v-card-text>
            <v-text-field
              id="personal-password"
              v-model="password"
              v-bind="inputProps"
              label="パスワード"
              autocomplete="new-password"
              :type="showPassword ? 'text' : 'password'"
              :error-messages="errors.password || undefined"
            >
              <template #append-inner>
                <!-- 欄の中のボタンは type="button" にし、押しても送信しない -->
                <v-btn
                  type="button"
                  :icon="
                    showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'
                  "
                  variant="text"
                  size="small"
                  density="comfortable"
                  :disabled="saving"
                  :aria-label="
                    showPassword
                      ? '入力した文字を隠す'
                      : '入力した文字を表示する'
                  "
                  :aria-pressed="showPassword"
                  @click="showPassword = !showPassword"
                />
              </template>
            </v-text-field>
          </v-card-text>
        </v-card>

        <!-- ===== YouTube連携 ===== -->
        <v-card
          variant="outlined"
          title="YouTube連携"
          subtitle="賛美歌のプレイリストを作成するときに使います"
          class="personal__section"
        >
          <template #prepend>
            <v-icon icon="mdi-youtube" color="red-darken-1" />
          </template>
          <template #append>
            <v-chip
              size="small"
              variant="tonal"
              :color="youtubeLinked ? 'success' : undefined"
              :prepend-icon="youtubeLinked ? 'mdi-check' : undefined"
            >
              {{ youtubeLinked ? "連携済み" : "未連携" }}
            </v-chip>
          </template>
          <v-card-actions>
            <v-spacer />
            <v-btn
              v-if="youtubeLinked"
              variant="text"
              color="error"
              :loading="youtubeBusy"
              :disabled="saving"
              @click="onYoutubeUnlink"
            >
              連携を解除
            </v-btn>
            <v-btn
              v-else
              variant="tonal"
              color="red-darken-1"
              prepend-icon="mdi-youtube"
              :disabled="saving || youtubeQuery.isPending.value"
              @click="onYoutubeConnect"
            >
              YouTubeと連携
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-card-text>

      <!-- フッター: 左に「廃棄」(文字だけ)、右に「更新」(臙脂) -->
      <v-divider />
      <v-card-actions class="personal__footer">
        <v-spacer />
        <v-btn
          variant="text"
          prepend-icon="mdi-trash-can-outline"
          :disabled="saving"
          @click="onRestore"
        >
          廃棄
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-lightning-bolt"
          :loading="saving"
          :disabled="
            saving || !studentQuery.data.value || studentQuery.isFetching.value
          "
          @click="onUpdate"
        >
          更新
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<style scoped>
.personal {
  position: relative;
  min-height: 100%;
}
/* パンくずはカードと同じ幅・位置にそろえる */
.personal__breadcrumbs {
  width: 62dvw;
  margin: 0 auto 8px;
  padding: 0;
  font-weight: 600;
  color: #fffff0;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}
.personal__breadcrumbs :deep(.v-breadcrumbs-item--disabled) {
  opacity: 1;
}
/* カードの幅は、サイドバーの開閉にかかわらず、見えている画面の幅の62% */
.personal__card {
  width: 62dvw;
  margin: 0 auto;
}
/* タイトル「ユーザー情報更新」は Noto Serif JP の太字 */
.personal__title {
  font-family: "Noto Serif JP", serif;
  font-weight: 700;
}
/* 3枚のカードを縦に並べ、間を16px空ける */
.personal__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
}
.personal__footer {
  gap: 8px;
  padding: 12px 24px;
}
</style>
