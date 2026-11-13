<script setup lang="ts">
// ユーザー情報更新(旧 (admin)/personal/page.tsx)
//
// 【YouTube連携について】
// バックエンドのYouTube連携API(/youtube/status, /youtube/authorize-url,
// /youtube/callback, /youtube/unlink)実装済み。トグルは連携状態を反映し、
// ONへの切り替えでGoogle同意画面へ画面遷移、OFFへの切り替えで連携解除を行う。
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { storeToRefs } from "pinia";
import api from "@/api/axios";
import { useFeedbackStore } from "@/stores/feedback";
import { useAuthStore } from "@/stores/auth";
import { EMPTY_STRING, extractErrorMessage } from "@/lib/constants";
import { required } from "@/lib/form";
import Hint from "@/components/Hint.vue";
import PageBackground from "@/components/PageBackground.vue";

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
  if (e) feedback.toast(extractErrorMessage(e, "データの取得に失敗しました"));
});

// ユーザーが入力した分だけを持ち、画面に出す値は「読み込んだ内容 + 入力」で作る
const edits = reactive<Partial<Editable>>({});
const form = computed<StudentForm>(() => ({
  ...(studentQuery.data.value ?? { ...emptyForm, id: userId.value }),
  ...edits,
}));
const field = <K extends keyof Editable>(key: K) =>
  computed<string>({
    get: () => form.value[key],
    set: (v) => {
      edits[key] = v;
    },
  });
const loginAccount = field("loginAccount");
const username = field("username");
const password = field("password");
const dateOfBirth = field("dateOfBirth");
const email = field("email");

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
// トグル＝連携ボタンの活性/非活性スイッチ。ONで初めてボタンが押せるようになり、
// OFFに戻すとその場で連携解除する。連携済みかどうかは、ボタンのアイコン色と
// ラベル(「連携済み」)で表す。
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
// トグルは、ユーザーが触るまでは連携状態に合わせる
const toggleOverride = ref<boolean | null>(null);
const youtubeToggleOn = computed(
  () => toggleOverride.value ?? youtubeLinked.value,
);

const unlinkMutation = useMutation({
  mutationFn: () => api.post("/youtube/unlink"),
  onSuccess: () => {
    queryClient.setQueryData(YOUTUBE_STATUS_KEY, false);
    feedback.toast("YouTube連携を解除しました");
  },
  onError: (e) => {
    feedback.toast(extractErrorMessage(e, "連携解除に失敗しました"));
    // 解除に失敗したので、実態に合わせてトグルもONへ戻す
    toggleOverride.value = true;
  },
});
const youtubeBusy = unlinkMutation.isPending;

const onYoutubeToggle = (checked: boolean | null) => {
  const on = !!checked;
  toggleOverride.value = on;
  // ONにしただけではまだ何もしない。連携ボタンが活性化するだけ。
  // OFFにした時点で、連携済みなら即座に解除する。
  if (!on && youtubeLinked.value) unlinkMutation.mutate();
};

// 連携ボタンのツールチップ。押せない時は「なぜ押せないか」を伝える
const youtubeHint = computed(() =>
  youtubeLinked.value
    ? "連携済みです"
    : youtubeToggleOn.value
      ? "YouTubeアカウントと連携します"
      : "「YouTube連携」をONにすると押せます",
);

const onYoutubeConnect = () => {
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

const checkAccount = async () => {
  errors.loginAccount = EMPTY_STRING;
  const name = form.value.loginAccount.trim();
  if (!name) return;
  try {
    await api.get("/students/duplicate-check", {
      params: { id: form.value.id ?? EMPTY_STRING, loginAccount: name },
    });
  } catch (e: unknown) {
    errors.loginAccount = extractErrorMessage(
      e,
      "このアカウントは既に使われています。",
    );
  }
};

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
  onSuccess: (data) => {
    // 次に開いたとき、更新後の内容を読み込み直す
    void queryClient.invalidateQueries({ queryKey: studentKey(userId.value) });
    feedback.toast(typeof data === "string" ? data : "更新しました");
    void router.push("/mainmenu");
  },
  onError: (e) => feedback.toast(extractErrorMessage(e, "更新に失敗しました")),
});
const saving = updateMutation.isPending;

const onUpdate = () => {
  const f = form.value;
  Object.assign(errors, {
    loginAccount: required(f.loginAccount) || errors.loginAccount,
    username: required(f.username),
    password: required(f.password),
    dateOfBirth: required(f.dateOfBirth),
    email: required(f.email),
  });
  if (Object.values(errors).some(Boolean)) {
    feedback.toast("入力情報不正");
    return;
  }
  updateMutation.mutate(f);
};

// 入力を捨てて、サーバーの最新の内容を読み込み直す
const onRestore = () => {
  Object.assign(errors, emptyErrors());
  for (const k of Object.keys(edits) as (keyof Editable)[]) delete edits[k];
  if (userId.value) void studentQuery.refetch();
};

/** 入力欄の共通設定(フォーカス時はオレンジ。背景画像の上でも読みやすいよう白ベタ) */
const inputProps = {
  variant: "outlined",
  density: "compact",
  color: "warning",
  "bg-color": "white",
} as const;
</script>

<template>
  <div class="personal noto-sans">
    <PageBackground src="/assets/mainmenu-bg4.webp" />

    <v-breadcrumbs
      class="personal__breadcrumbs"
      :items="[
        { title: 'メインメニュー', to: '/mainmenu' },
        { title: 'ユーザー情報', disabled: true },
      ]"
    />

    <div class="studentedition-card glass-panel personal__card">
      <div class="personal__header">
        <v-icon
          icon="mdi-card-account-details-outline"
          size="20"
          class="mr-2"
        />
        <h1 class="text-title-large">ユーザー情報更新</h1>
      </div>

      <div class="pa-6">
        <!-- ===== 基本情報 ===== -->
        <fieldset class="personal__set">
          <legend class="personal__legend">基本情報</legend>
          <v-row density="compact">
            <v-col cols="12" sm="6">
              <label for="personal-account" class="form-label"
                >アカウント</label
              >
              <v-text-field
                id="personal-account"
                v-model="loginAccount"
                v-bind="inputProps"
                placeholder="アカウントを入力してください"
                :error-messages="errors.loginAccount || undefined"
                @blur="checkAccount"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <label for="personal-username" class="form-label">名称</label>
              <v-text-field
                id="personal-username"
                v-model="username"
                v-bind="inputProps"
                placeholder="名称を入力してください"
                :error-messages="errors.username || undefined"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <label for="personal-email" class="form-label">メール</label>
              <v-text-field
                id="personal-email"
                v-model="email"
                v-bind="inputProps"
                placeholder="メールを入力してください"
                :error-messages="errors.email || undefined"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <label for="personal-dob" class="form-label">生年月日</label>
              <v-text-field
                id="personal-dob"
                v-model="dateOfBirth"
                v-bind="inputProps"
                type="date"
                :error-messages="errors.dateOfBirth || undefined"
              />
            </v-col>
          </v-row>
        </fieldset>

        <v-divider class="my-5" />

        <!-- ===== セキュリティ ===== -->
        <fieldset class="personal__set">
          <legend class="personal__legend">セキュリティ</legend>
          <label for="personal-password" class="form-label">パスワード</label>
          <v-text-field
            id="personal-password"
            v-model="password"
            v-bind="inputProps"
            :type="showPassword ? 'text' : 'password'"
            placeholder="パスワードを入力してください"
            :error-messages="errors.password || undefined"
          >
            <template #append-inner>
              <v-btn
                :icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                variant="text"
                size="x-small"
                :aria-label="
                  showPassword ? 'パスワードを隠す' : 'パスワードを表示'
                "
                @click="showPassword = !showPassword"
              />
            </template>
          </v-text-field>
        </fieldset>

        <v-divider class="my-5" />

        <!-- ===== 外部連携 ===== -->
        <fieldset class="personal__set">
          <legend class="personal__legend">外部連携</legend>
          <div class="personal__link-row">
            <!-- 左: アイコン・タイトル・状態 -->
            <div class="d-flex align-center ga-3" style="min-width: 0">
              <v-icon
                icon="mdi-youtube"
                size="32"
                :color="youtubeLinked ? 'grey' : 'red-darken-1'"
              />
              <div style="min-width: 0">
                <label for="personal-youtube" class="form-label"
                  >YouTube連携</label
                >
                <div class="d-flex align-center ga-2">
                  <v-chip
                    size="small"
                    label
                    variant="flat"
                    :color="
                      youtubeLinked ? 'green-lighten-4' : 'grey-lighten-3'
                    "
                    class="font-weight-bold"
                  >
                    {{ youtubeLinked ? "連携済み" : "未連携" }}
                  </v-chip>
                  <span class="text-body-small text-medium-emphasis"
                    >ONにすると連携ボタンが押せます</span
                  >
                </div>
              </div>
            </div>

            <!-- 右: トグル + 連携ボタン(連携処理中はスイッチに読み込み表示を出す) -->
            <div class="d-flex align-center ga-3 flex-shrink-0">
              <Hint
                v-slot="{ props }"
                label="ONで連携ボタンが押せるようになります"
              >
                <span v-bind="props" class="d-inline-flex">
                  <v-switch
                    id="personal-youtube"
                    :model-value="youtubeToggleOn"
                    :loading="youtubeBusy ? 'warning' : false"
                    :disabled="youtubeBusy"
                    color="warning"
                    inset
                    hide-details
                    density="compact"
                    @update:model-value="onYoutubeToggle"
                  />
                </span>
              </Hint>

              <Hint v-slot="{ props }" :label="youtubeHint" wrap-disabled>
                <v-btn
                  v-bind="props"
                  variant="outlined"
                  class="text-grey-darken-3"
                  :disabled="!youtubeToggleOn || youtubeLinked || youtubeBusy"
                  @click="onYoutubeConnect"
                >
                  <v-icon
                    icon="mdi-youtube"
                    :color="youtubeLinked ? 'grey' : 'red-darken-1'"
                    class="mr-1"
                  />
                  {{ youtubeLinked ? "連携済み" : "YouTubeと連携" }}
                </v-btn>
              </Hint>
            </div>
          </div>
        </fieldset>
      </div>

      <div class="personal__footer">
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-lightning-bolt"
          :loading="saving"
          @click="onUpdate"
        >
          更新
        </v-btn>
        <v-btn
          color="#6b7280"
          variant="flat"
          prepend-icon="mdi-trash-can-outline"
          @click="onRestore"
        >
          廃棄
        </v-btn>
      </div>
    </div>
  </div>
</template>

<style scoped>
.personal {
  position: relative;
  min-height: 100%;
}
.personal__breadcrumbs {
  max-width: 672px;
  margin: 0 auto 8px;
  padding: 0;
  font-weight: 600;
  color: #fffff0;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}
.personal__breadcrumbs :deep(.v-breadcrumbs-item--disabled) {
  opacity: 1;
}
.personal__card {
  position: relative;
  max-width: 672px;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.85) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.personal__header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #ff883e;
  color: #fff;
}
.personal__set {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.personal__legend {
  margin-bottom: 12px;
  font-size: 1rem;
  font-weight: 700;
}
.personal__link-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  background: #fff;
}
@media (min-width: 600px) {
  .personal__link-row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
.personal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.6);
}
</style>
