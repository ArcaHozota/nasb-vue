<script setup lang="ts">
// ログイン画面(旧 app/login/page.tsx)
import { ref } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";
import { useAuthStore } from "@/stores/auth";
import { EMPTY_STRING } from "@/lib/constants";
import PageBackground from "@/components/PageBackground.vue";

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
    <PageBackground src="/assets/login-bg.webp" />

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
          bg-color="rgba(255,255,255,0.8)"
          color="primary"
          hide-details
          class="mb-4"
        />

        <label for="login-password" class="login-card__label">パスワード</label>
        <v-text-field
          id="login-password"
          v-model="password"
          autocomplete="current-password"
          type="password"
          variant="outlined"
          density="compact"
          bg-color="rgba(255,255,255,0.8)"
          color="primary"
          hide-details
          class="mb-4"
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
          block
          :loading="loading"
          class="font-weight-bold"
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
  align-items: center;
  justify-content: center;
}
.login-card {
  width: 360px;
  max-width: calc(100% - 32px);
  padding: 24px 16px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.25);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(40px) saturate(150%);
  -webkit-backdrop-filter: blur(40px) saturate(150%);
}
.login-card__title {
  margin-bottom: 24px;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.025em;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
.login-card__label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.9);
}
.login-card__error {
  background: rgba(254, 242, 242, 0.95) !important;
}
</style>
