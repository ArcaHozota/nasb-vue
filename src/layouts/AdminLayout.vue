<script setup lang="ts">
// src/layouts/AdminLayout.vue
// 旧 layouts/AdminLayout.tsx を移植(サイドバー・上部ナビバー・ログアウト)
//
// 認証チェック(旧: user が無ければ fetchMe() → 失敗時 /home へリダイレクト)は
// router/index.ts の router.beforeEach に集約済みなので、ここでは重複させていない。
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useFeedbackStore } from "@/stores/feedback";
import { DELAY_APOLOGY, EMPTY_STRING } from "@/constants";
import brandLogo from "@/assets/jerusalem-cross2.svg";

const router = useRouter();
const auth = useAuthStore();
const feedback = useFeedbackStore();

const keyword = ref(EMPTY_STRING);
const userMenuOpen = ref(false);

const navItems = [
  {
    key: "bookSearch",
    icon: "⚓",
    title: "聖書章節選択",
    action: () => feedback.toast(DELAY_APOLOGY),
  },
  {
    key: "bookAdd",
    icon: "📦",
    title: "聖書章節入力",
    action: () => router.push("/books/add"),
  },
  {
    key: "hymns",
    icon: "🎵",
    title: "賛美歌一覧",
    action: () => router.push("/hymns"),
  },
  {
    key: "randomFive",
    icon: "🔀",
    title: "ランダム五つ",
    action: () => router.push("/hymns/random-five"),
  },
];

const onLogout = async () => {
  const ok = await feedback.confirm("ログアウトしてよろしいでしょうか。", "警告");
  if (!ok) return;
  await auth.logout();
  // 旧実装同様、状態を完全にリセットするためフルリロードする
  window.location.href = "/home";
};

const onSearch = () => {
  const trimmed = keyword.value.trim();
  if (!trimmed) return;
  router.push(`/hymns/random-five?keyword=${encodeURIComponent(trimmed)}`);
};

const onSearchKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Enter") onSearch();
};

const toggleUserMenu = () => {
  userMenuOpen.value = !userMenuOpen.value;
};
const closeUserMenu = () => {
  userMenuOpen.value = false;
};

const goPersonal = () => {
  closeUserMenu();
  router.push(`/personal?userId=${auth.userId || EMPTY_STRING}`);
};
</script>

<template>
  <div class="flex">
    <!-- ===== 左サイドバー(旧 Drawer) ===== -->
    <aside class="fixed inset-y-0 left-0 z-20 flex w-64 flex-col bg-gray-900 text-white">
      <!-- ブランド -->
      <button
        type="button"
        class="flex shrink-0 items-center gap-2 bg-[#fffff0] px-4 py-6 text-left"
        @click="router.push('/mainmenu')"
      >
        <img :src="brandLogo" alt="" class="h-[49px] w-[49px] object-cover" />
        <span class="effect-shine whitespace-nowrap text-[1.9rem] leading-none">NASB1995</span>
      </button>
      <hr class="border-white/10" />

      <!-- メインナビ -->
      <nav class="flex-1 overflow-y-auto py-0">
        <button
          v-for="item in navItems"
          :key="item.key"
          type="button"
          class="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-white/10"
          @click="item.action"
        >
          <span class="w-5 text-center">{{ item.icon }}</span>
          <span>{{ item.title }}</span>
        </button>
      </nav>

      <!-- ユーザードロップダウン -->
      <hr class="border-white/10" />
      <div class="relative shrink-0">
        <button
          type="button"
          class="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-white/10"
          @click="toggleUserMenu"
        >
          <span
            class="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/20 text-xs"
          >
            {{ auth.username?.slice(0, 1) }}
          </span>
          <span class="flex-1 text-[0.9rem]">{{ auth.username }}</span>
          <span class="text-xs">▴</span>
        </button>

        <!-- クリック外を検知して閉じるための透明レイヤー -->
        <div v-if="userMenuOpen" class="fixed inset-0 z-10" @click="closeUserMenu" />

        <div
          v-if="userMenuOpen"
          class="absolute bottom-full left-0 z-20 mb-1 w-56 rounded-md border border-gray-200 bg-white py-1 text-sm text-gray-800 shadow-lg"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-100"
            @click="goPersonal"
          >
            🛠 個人スペース
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-100"
            @click="closeUserMenu(); feedback.toast(DELAY_APOLOGY)"
          >
            ✉ メッセージ
          </button>
          <hr class="my-1 border-gray-200" />
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-red-700 hover:bg-gray-100"
            @click="onLogout"
          >
            🚪 ログアウト
          </button>
        </div>
      </div>
    </aside>

    <div class="flex-1 pl-64">
      <!-- ===== 上部バー(旧 AppBar) ===== -->
      <header class="fixed inset-x-0 top-0 z-10 ml-64 flex h-12 items-center justify-end gap-2 bg-gray-900 px-4">
        <div class="relative">
          <input
            v-model="keyword"
            type="text"
            placeholder="検索"
            class="w-60 rounded bg-gray-100 py-1.5 pl-8 pr-2 text-sm text-gray-900 outline-none"
            @keydown="onSearchKeyDown"
          />
          <span class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">🔍</span>
        </div>
        <button
          type="button"
          class="rounded p-1.5 text-red-500 hover:bg-white/10"
          title="ログアウト"
          @click="onLogout"
        >
          🚪
        </button>
      </header>

      <!-- ===== 各画面 ===== -->
      <main class="mt-12">
        <router-view />
      </main>
    </div>
  </div>
</template>
