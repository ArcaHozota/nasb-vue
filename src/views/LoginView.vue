<script setup lang="ts">
// src/views/LoginView.vue
// 旧 views/LoginView.tsx を移植
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { EMPTY_STRING } from "@/constants";
import bgImage from "@/assets/mainmenu-bg6.webp";

const router = useRouter();
const auth = useAuthStore();

const username = ref(EMPTY_STRING);
const password = ref(EMPTY_STRING);
const error = ref(EMPTY_STRING);
const loading = ref(false);

const onLogin = async () => {
  error.value = EMPTY_STRING;
  loading.value = true;
  try {
    await auth.login(username.value, password.value);
    router.push("/mainmenu");
  } catch {
    // SecurityConfig の failureHandler が 401 を返す
    error.value = "ユーザー名またはパスワードが正しくありません。";
  } finally {
    loading.value = false;
  }
};

const onEnter = (e: KeyboardEvent) => {
  if (e.key === "Enter") onLogin();
};
</script>

<template>
  <div class="relative min-h-screen flex items-center justify-center">
    <img
      :src="bgImage"
      alt=""
      class="fixed inset-0 -z-10 h-full w-full object-cover"
    />

    <div
      class="w-[360px] rounded-[18px] border border-white/45 bg-white/25 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl backdrop-saturate-150"
    >
      <div class="p-4">
        <h1
          class="mb-6 text-center text-2xl font-bold tracking-wide text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.4)]"
        >
          NASB1995
        </h1>

        <label class="mb-1 block text-sm text-white/90">ユーザー名</label>
        <input
          v-model="username"
          type="text"
          class="mb-4 w-full rounded-md border border-white/60 bg-white/80 px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <label class="mb-1 block text-sm text-white/90">パスワード</label>
        <input
          v-model="password"
          type="password"
          class="mb-4 w-full rounded-md border border-white/60 bg-white/80 px-3 py-2 text-sm outline-none focus:border-primary"
          @keydown="onEnter"
        />

        <p
          v-if="error"
          class="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {{ error }}
        </p>

        <button
          type="button"
          class="w-full rounded-md bg-primary py-2 text-sm font-medium text-white disabled:opacity-60"
          :disabled="loading"
          @click="onLogin"
        >
          <span v-if="loading" class="inline-block animate-spin">⟳</span>
          <span v-else>ログイン</span>
        </button>
      </div>
    </div>
  </div>
</template>
