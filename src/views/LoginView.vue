<script setup lang="ts">
// ログイン画面(旧 app/login/page.tsx)
import { ref } from "vue";
import "@/plugins/fonts/login";
import { useRouter } from "vue-router";
import axios from "axios";
import { useAuthStore } from "@/stores/auth";
import { EMPTY_STRING } from "@/lib/constants";
import PageBackground from "@/components/PageBackground.vue";
import backgroundImage from "@/assets/login-bg.webp?no-inline";

const router = useRouter();
const auth = useAuthStore();

const username = ref(EMPTY_STRING);
const password = ref(EMPTY_STRING);
const error = ref(EMPTY_STRING);
const loading = ref(false);

// <form> の送信にすることで、Enter での送信(日本語変換中の Enter は除く)や
// パスワードマネージャーの保存・自動入力をブラウザに任せる
const onLogin = async () => {
  if (loading.value) return; // Enter の連打などによる二重送信を防ぐ
  error.value = EMPTY_STRING;
  loading.value = true;
  try {
    await auth.login(username.value, password.value);
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

    <div class="login-card">
      <form aria-label="ログイン" @submit.prevent="onLogin">
        <h1 class="login-card__title">NASB1995</h1>

        <label for="login-username" class="login-card__label">ユーザー名</label>
        <v-text-field
          id="login-username"
          v-model="username"
          autocomplete="username"
          type="text"
          variant="outlined"
          density="compact"
          bg-color="rgba(255,255,255,0.97)"
          base-color="#64748b"
          color="primary"
          hide-details
          class="login-card__input"
        />

        <label for="login-password" class="login-card__label">パスワード</label>
        <v-text-field
          id="login-password"
          v-model="password"
          autocomplete="current-password"
          type="password"
          variant="outlined"
          density="compact"
          bg-color="rgba(255,255,255,0.97)"
          base-color="#64748b"
          color="primary"
          hide-details
          class="login-card__input"
        />

        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          icon="mdi-alert-circle-outline"
          :text="error"
          class="mb-4 login-card__error"
        />

        <v-btn
          type="submit"
          color="primary"
          variant="flat"
          height="46"
          block
          :loading="loading"
          class="login-card__submit"
        >
          ログイン
        </v-btn>
      </form>
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
.login-card {
  width: 360px;
  max-width: calc(100% - 32px);
  padding: 30px 28px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.66);
  box-shadow:
    0 16px 42px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  /* 標準指定を最後に置き、圧縮後も両方の宣言を残す。 */
  -webkit-backdrop-filter: blur(24px) saturate(115%);
  backdrop-filter: blur(24px) saturate(115%);
}
.login-card__title {
  margin-bottom: 24px;
  text-align: center;
  font-size: 1.625rem;
  font-weight: 900;
  letter-spacing: 0.025em;
  color: #fff;
}
.login-card__label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #fff;
}
.login-card__input {
  margin-bottom: 20px;
}
.login-card__input :deep(.v-field) {
  border-radius: 6px;
}
.login-card__input :deep(.v-field__input) {
  min-height: 46px;
  color: #172033;
  opacity: 1;
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
