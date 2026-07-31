<script setup lang="ts">
// src/layouts/AdminLayout.vue
// 旧 layouts/AdminLayout.tsx を移植(サイドバー・上部ナビバー・ログアウト)
//
// 認証チェック(旧: user が無ければ fetchMe() → 失敗時 /home へリダイレクト)は
// router/index.ts の router.beforeEach に集約済みなので、ここでは重複させていない。
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Anchor,
  Package,
  Music,
  Shuffle,
  UserCog,
  MessageSquare,
  LogOut,
  ChevronUp,
  Search,
} from "@lucide/vue";
import { useAuthStore } from "@/stores/auth";
import { useFeedbackStore } from "@/stores/feedback";
import { DELAY_APOLOGY, EMPTY_STRING } from "@/constants";
import brandLogo from "@/assets/jerusalem-cross2.svg";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const feedback = useFeedbackStore();

const keyword = ref(EMPTY_STRING);
const userMenuOpen = ref(false);

const navItems = [
  {
    key: "bookSearch",
    icon: Anchor,
    title: "聖書章節選択",
    action: () => feedback.toast(DELAY_APOLOGY),
    // 実ページが無い(トースト表示のみ)ため、アクティブ判定の対象外
    isActive: () => false,
  },
  {
    key: "bookAdd",
    icon: Package,
    title: "聖書章節入力",
    action: () => router.push("/books/add"),
    isActive: () => route.path === "/books/add",
  },
  {
    key: "hymns",
    icon: Music,
    title: "賛美歌一覧",
    action: () => router.push("/hymns"),
    // /hymns配下の一覧・追加・編集・楽譜画面をまとめて「賛美歌一覧」としてアクティブ扱いにする。
    // ただし /hymns/random-five は別ナビ項目なのでここには含めない。
    isActive: () =>
      route.path === "/hymns" ||
      (route.path.startsWith("/hymns/") && !route.path.startsWith("/hymns/random-five")),
  },
  {
    key: "randomFive",
    icon: Shuffle,
    title: "ランダム五つ",
    action: () => router.push("/hymns/random-five"),
    isActive: () => route.path.startsWith("/hymns/random-five"),
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
  <!-- 画面全体をFlexboxで固定し、スクロールは<main>内だけに閉じ込める。
       以前はサイドバー/上部バーをposition:fixed + margin計算(mt-12/pl-64/ml-64)で
       位置合わせしていたが、ピクセル計算のズレでページ全体にごくわずかな縦
       オーバーフローが生じ、意図しないスクロールバーの原因になっていた。 -->
  <div class="flex h-screen overflow-hidden">
    <!-- ===== 左サイドバー(旧 Drawer) ===== -->
    <aside class="flex w-64 shrink-0 flex-col bg-gray-900 text-white">
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
      <!-- 項目数が少なく現状スクロール不要なため overflow-y-auto は付けていない
           (右にはみ出すアクティブストライプがクリップされないようにするため) -->
      <nav class="flex-1 py-0">
        <button
          v-for="item in navItems"
          :key="item.key"
          type="button"
          class="relative flex w-full items-center gap-3 py-3 pl-4 pr-0 text-sm transition-colors"
          :class="
            item.isActive()
              ? 'rounded-l-full bg-white text-gray-900'
              : 'text-white hover:bg-white/10'
          "
          @click="item.action"
        >
          <component :is="item.icon" class="h-5 w-5 shrink-0" />
          <span>{{ item.title }}</span>
          <!-- サイドバー右端の外側にはみ出す6px幅の白いストライプ(アクティブ時のみ) -->
          <span
            v-if="item.isActive()"
            class="absolute -right-1.5 top-0 bottom-0 w-1.5 bg-white"
          />
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
          <ChevronUp class="h-4 w-4 shrink-0" />
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
            <UserCog class="h-4 w-4" /> 個人スペース
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-100"
            @click="closeUserMenu(); feedback.toast(DELAY_APOLOGY)"
          >
            <MessageSquare class="h-4 w-4" /> メッセージ
          </button>
          <hr class="my-1 border-gray-200" />
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-red-700 hover:bg-gray-100"
            @click="onLogout"
          >
            <LogOut class="h-4 w-4" /> ログアウト
          </button>
        </div>
      </div>
    </aside>

    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- ===== 上部バー(旧 AppBar) ===== -->
      <header class="flex h-12 shrink-0 items-center justify-end gap-2 bg-gray-900 px-4">
        <div class="relative">
          <input
            v-model="keyword"
            type="text"
            placeholder="検索"
            class="w-60 rounded bg-gray-100 py-1.5 pl-8 pr-2 text-sm text-gray-900 outline-none"
            @keydown="onSearchKeyDown"
          />
          <Search class="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        </div>
        <button
          type="button"
          class="rounded p-1.5 text-red-500 hover:bg-white/10"
          title="ログアウト"
          @click="onLogout"
        >
          <LogOut class="h-4 w-4" />
        </button>
      </header>

      <!-- ===== 各画面(ここだけがスクロールする) ===== -->
      <main class="flex-1 overflow-y-auto p-[3px]">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* mainはoverflow-y-autoで中身が高いときにスクロールバーの見た目が出るが、
   ガラス風デザインとの統一感のため、スクロール自体は維持しつつ見た目だけ隠す。 */
main {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* 旧Edge/IE */
}

main::-webkit-scrollbar {
  display: none; /* Chrome/Safari/新Edge */
}
</style>
