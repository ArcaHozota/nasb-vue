<script setup lang="ts">
// ログイン画面(旧 app/login/page.tsx)
import { ref } from "vue";
import "@/plugins/fonts/login";
import { useRouter } from "vue-router";
import axios from "axios";
import { useAuthStore } from "@/stores/auth";
import { EMPTY_STRING } from "@/lib/constants";
import { required } from "@/lib/form";
import PageBackground from "@/components/PageBackground.vue";
import backgroundImage from "@/assets/login-bg.webp?no-inline";

const router = useRouter();
const auth = useAuthStore();

const username = ref(EMPTY_STRING);
const password = ref(EMPTY_STRING);
const error = ref(EMPTY_STRING);
const loading = ref(false);
// パスワードの「表示/非表示」(目のボタン)
const showPassword = ref(false);
const MIN_LOGIN_DURATION_MS = 3300;

// 画面での入力チェック(Vuetify の v-form と rules)。空のまま送信すると、欄ごとに「入力してください。」を出し、
// サーバーへは送らない。チェックは送信したときに行う(validate-on="submit")
type FormRef = { validate: () => Promise<{ valid: boolean }> };
const form = ref<FormRef | null>(null);
const requiredRule = [(v: string) => required(v) || true];

// <form> の送信にすることで、Enter での送信(日本語変換中の Enter は除く)や
// パスワードマネージャーの保存・自動入力をブラウザに任せる
const onLogin = async () => {
  if (loading.value) return; // Enter の連打などによる二重送信を防ぐ
  const { valid } = (await form.value?.validate()) ?? { valid: false };
  if (!valid) return;
  error.value = EMPTY_STRING;
  loading.value = true;
  try {
    // 失敗応答も最低表示時間まで待つ。通信が遅い場合は、その完了まで待つ。
    const [result] = await Promise.allSettled([
      auth.login(username.value, password.value),
      new Promise<void>((resolve) =>
        setTimeout(resolve, MIN_LOGIN_DURATION_MS),
      ),
    ]);
    if (result.status === "rejected") throw result.reason;
    await router.push("/mainmenu");
  } catch (e: unknown) {
    // 認証失敗はサーバーが 401 を返す。それ以外(通信エラー・500 など)は
    // パスワードの誤りと区別して伝える
    error.value =
      axios.isAxiosError(e) && e.response?.status === 401
        ? "ユーザー名またはパスワードが正しくありません。"
        : "ログインできませんでした。時間をおいて再度お試しください。";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="login-page">
    <PageBackground :src="backgroundImage" />

    <div class="login-card" :class="{ 'login-card--loading': loading }">
      <v-form
        ref="form"
        validate-on="submit"
        aria-label="ログイン"
        :aria-busy="loading"
        @submit.prevent="onLogin"
      >
        <div class="login-card__fields" :aria-hidden="loading">
          <h1 class="login-card__title">NASB1995</h1>

          <!-- 入力欄: Vuetify の outlined。ラベルは欄の中にあり、入力・フォーカスで枠の上へ移る。
               暗いガラスのカードの上なので theme="dark"(Vuetify の暗い背景用の配色。文字・アイコンが白系になる) -->
          <v-text-field
            id="login-username"
            v-model="username"
            label="ユーザー名"
            :disabled="loading"
            autocomplete="username"
            type="text"
            variant="outlined"
            theme="dark"
            prepend-inner-icon="mdi-account-outline"
            base-color="rgba(255,255,255,0.75)"
            color="#f3e3c3"
            :rules="requiredRule"
            hide-details="auto"
            class="login-card__input"
          />

          <v-text-field
            id="login-password"
            v-model="password"
            label="パスワード"
            :disabled="loading"
            autocomplete="current-password"
            :type="showPassword ? 'text' : 'password'"
            variant="outlined"
            theme="dark"
            prepend-inner-icon="mdi-lock-outline"
            base-color="rgba(255,255,255,0.75)"
            color="#f3e3c3"
            :rules="requiredRule"
            hide-details="auto"
            class="login-card__input"
          >
            <template #append-inner>
              <!-- 欄の中のボタンは type="button" にし、押しても送信しない -->
              <v-btn
                type="button"
                icon
                variant="text"
                size="small"
                density="comfortable"
                :disabled="loading"
                :aria-label="
                  showPassword ? '入力した文字を隠す' : '入力した文字を表示する'
                "
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                <v-icon
                  :icon="
                    showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'
                  "
                  size="20"
                />
              </v-btn>
            </template>
          </v-text-field>

          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            density="compact"
            icon="mdi-alert-circle-outline"
            :text="error"
            class="mb-4 login-card__error"
          />
        </div>

        <span v-if="loading" role="status" class="sr-only">ログイン中です</span>
        <v-btn
          type="submit"
          color="primary"
          variant="flat"
          height="46"
          block
          :loading="loading"
          :aria-disabled="loading"
          :aria-label="loading ? 'ログイン中' : 'ログイン'"
          class="login-card__submit"
        >
          ログイン
          <template #loader>
            <v-progress-circular
              indeterminate
              size="18"
              width="2"
              aria-hidden="true"
            />
          </template>
        </v-btn>
      </v-form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  display: flex;
  min-height: 100vh;
  padding: 24px 0;
  align-items: center;
  justify-content: center;
}
/* カードの中の文字は白(入力欄は theme="dark" で、この色を受け継いで白系になる) */
.login-card {
  position: relative;
  color: #fff;
  width: 360px;
  max-width: calc(100% - 32px);
  padding: 30px 28px;
  border: 1px solid transparent;
  border-radius: 20px;
}
/* カードの外観だけを薄くし、ボタンの色と読みやすさを保つ。 */
.login-card::before {
  content: "";
  position: absolute;
  inset: -1px;
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: inherit;
  background: rgba(15, 23, 42, 0.66);
  box-shadow:
    0 16px 42px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  /* 標準指定を最後に置き、圧縮後も両方の宣言を残す。 */
  -webkit-backdrop-filter: blur(24px) saturate(115%);
  backdrop-filter: blur(24px) saturate(115%);
}
.login-card form {
  position: relative;
}
/* 待機中: 背景・枠・影をまとめて33%にする。背景色は待機中だけ不透明にしてから全体を33%にし、
   実効的な背景色の不透明度も33%にする(66%のまま全体を33%にすると約22%まで薄くなるため)。 */
.login-card--loading::before {
  background: rgb(15, 23, 42);
  opacity: 0.33;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
.login-card--loading .login-card__fields {
  visibility: hidden;
}
.login-card__title {
  margin-bottom: 22px;
  text-align: center;
  font-size: 1.625rem;
  font-weight: 900;
  letter-spacing: 0.025em;
  color: #fff;
}
.login-card__input {
  margin-bottom: 20px;
}
/* ブラウザの自動入力で欄が水色に塗られないようにする(背景色の変化を事実上止め、文字は白のまま) */
.login-card__input :deep(input:-webkit-autofill) {
  -webkit-text-fill-color: #fff;
  caret-color: #fff;
  transition: background-color 600000s 0s;
}
.login-card__submit {
  border: 1px solid rgba(255, 255, 255, 0.33);
  border-radius: 6px;
  font-weight: 800;
}
.login-card__error {
  background: rgba(254, 242, 242, 0.95) !important;
}
</style>
