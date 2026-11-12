<script setup lang="ts">
// src/layouts/AdminLayout.vue
// ログイン後の画面の共通レイアウト(旧 (admin)/layout.tsx)。
//  - ログイン確認・未保存の確認は router/guards.ts が受け持つ
//  - ログイン状態の定期確認は useSessionCheck()
// サイドバー: デスクトップは折りたたみ可能(アイコンのみ表示、Ctrl/⌘+B でも切替)、
// モバイル(768px未満)は左から出るドロワー。折りたたみ状態は localStorage に保存して次回も復元する。
// 画面全体の高さを固定し、スクロールは右側のメインエリア内だけに閉じ込める。
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { useFeedbackStore } from "@/stores/feedback";
import { confirmDiscardUnsaved } from "@/router/guards";
import { hardRedirectHome } from "@/lib/session";
import { DELAY_APOLOGY, EMPTY_STRING } from "@/lib/constants";
import { useIsMobile } from "@/composables/useIsMobile";
import { useSessionCheck } from "@/composables/useSessionCheck";

const RAIL_STORAGE_KEY = "sidebar_rail";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { username } = storeToRefs(auth);
const feedback = useFeedbackStore();
const isMobile = useIsMobile();

useSessionCheck();

// ===== サイドバーの開閉 =====
// drawer: モバイルのドロワーの開閉 / rail: デスクトップの折りたたみ(アイコンのみ)
const drawer = ref(!isMobile.value);
const rail = ref(readRail());
watch(isMobile, (mobile) => {
  drawer.value = !mobile;
});
watch(rail, (v) => {
  try {
    localStorage.setItem(RAIL_STORAGE_KEY, String(v));
  } catch {
    // 保存できない環境では、次回は開いた状態から始める
  }
});

function readRail() {
  try {
    return localStorage.getItem(RAIL_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

const toggleSidebar = () => {
  if (isMobile.value) drawer.value = !drawer.value;
  else rail.value = !rail.value;
};
const isRail = computed(() => rail.value && !isMobile.value);

// Ctrl/⌘+B でサイドバーを開閉(旧 shadcn/ui Sidebar と同じ)
const onKeydown = (e: KeyboardEvent) => {
  if (e.key.toLowerCase() === "b" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    toggleSidebar();
  }
};
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

// モバイルのドロワーは、画面遷移したら閉じる
const closeOnMobile = () => {
  if (isMobile.value) drawer.value = false;
};

// ===== ナビ =====
type NavItem = {
  key: string;
  icon: string;
  title: string;
  action: () => void;
  isActive: boolean;
};

const go = (url: string) => {
  // 未保存の確認は router/guards.ts の confirmUnsaved が行う
  void router.push(url);
};

const navItems = computed<NavItem[]>(() => {
  const path = route.path;
  return [
    {
      key: "bookSearch",
      icon: "mdi-anchor",
      title: "聖書章節選択",
      action: () => feedback.toast(DELAY_APOLOGY),
      // 実ページが無い(トースト表示のみ)ため、アクティブ判定の対象外
      isActive: false,
    },
    {
      key: "bookAdd",
      icon: "mdi-package-variant-closed",
      title: "聖書章節入力",
      action: () => go("/books/add"),
      isActive: path === "/books/add",
    },
    {
      key: "hymns",
      icon: "mdi-music",
      title: "賛美歌一覧",
      action: () => go("/hymns"),
      // /hymns配下をまとめて「賛美歌一覧」としてアクティブ扱いにする。
      // ただし /hymns/random-five は別ナビ項目なのでここには含めない。
      isActive:
        path === "/hymns" ||
        (path.startsWith("/hymns/") && !path.startsWith("/hymns/random-five")),
    },
    {
      key: "randomFive",
      icon: "mdi-shuffle-variant",
      title: "ランダム検索",
      action: () => go("/hymns/random-five"),
      isActive: path.startsWith("/hymns/random-five"),
    },
    {
      key: "receipts",
      icon: "mdi-receipt-text-outline",
      title: "レシート明細入力",
      // /receipts のページはまだ無いため「未実装」のトーストだけ出す。
      action: () => feedback.toast(DELAY_APOLOGY),
      isActive: false,
    },
  ];
});
const hasActive = computed(() => navItems.value.some((i) => i.isActive));

/** 区切り線は「非アクティブ同士が隣り合う境界」だけに出す(アクティブなタブとは接しない) */
const showDivider = (idx: number) =>
  idx > 0 &&
  !navItems.value[idx].isActive &&
  !navItems.value[idx - 1].isActive;

const onNav = (item: NavItem) => {
  item.action();
  closeOnMobile();
};

// ===== ログアウト =====
const onLogout = async () => {
  if (!(await confirmDiscardUnsaved())) return;
  const ok = await feedback.confirm("ログアウトしますか？", "警告");
  if (!ok) return;
  await auth.logout();
  // 状態を完全にリセットするためフルリロードする
  // (vue-query のキャッシュを残すと、次にログインした人に前の人のデータが見えてしまう)。
  // 破棄に同意済みの未保存警告(beforeunload)は出さない。
  hardRedirectHome();
};

// ===== ヘッダーの検索 =====
const keyword = ref(EMPTY_STRING);
const onSearch = () => {
  const trimmed = keyword.value.trim();
  if (!trimmed) return;
  // t(検索した時刻)を付けて、同じキーワードでも毎回別のURLにする。
  // ランダム検索の画面は keyword と t の変化を見て検索し直す。
  const to = {
    path: "/hymns/random-five",
    query: { keyword: trimmed, t: String(Date.now()) },
  };
  // ランダム検索の画面にいるときは履歴を積まずに置き換える
  // (何度ヘッダー検索しても「戻る」1回で前の画面へ戻れるように)。
  if (route.path.startsWith("/hymns/random-five")) void router.replace(to);
  else void router.push(to);
};
</script>

<template>
  <v-navigation-drawer
    v-model="drawer"
    :rail="isRail"
    rail-width="48"
    width="256"
    color="sidebar"
    border="0"
    class="admin-sidebar"
  >
    <!-- ===== ブランド ===== -->
    <template #prepend>
      <button
        type="button"
        class="admin-brand"
        :class="{ 'admin-brand--rail': isRail }"
        aria-label="メインメニューへ"
        @click="go('/mainmenu'); closeOnMobile()"
      >
        <img src="/assets/jerusalem-cross2.svg" alt="" class="admin-brand__logo" />
        <span v-if="!isRail" class="effect-shine admin-brand__title">NASB1995</span>
      </button>
    </template>

    <!-- ===== メインナビ ===== -->
    <div class="admin-nav">
      <!-- 右端の縦ストライプ(折りたたみ時はタブ表現が成り立たないので出さない) -->
      <span v-if="hasActive && !isRail" class="admin-nav__stripe" />
      <ul class="admin-nav__list">
        <li v-for="(item, idx) in navItems" :key="item.key">
          <v-btn
            block
            variant="text"
            :class="[
              'admin-nav__item',
              {
                'admin-nav__item--active': item.isActive,
                'admin-nav__item--divider': showDivider(idx),
                'admin-nav__item--rail': isRail,
              },
            ]"
            :aria-current="item.isActive ? 'page' : undefined"
            @click="onNav(item)"
          >
            <v-icon :icon="item.icon" :size="isRail ? 16 : 20" />
            <span v-if="!isRail" class="admin-nav__label">{{ item.title }}</span>
            <v-tooltip
              activator="parent"
              location="end"
              :disabled="!isRail"
              :text="item.title"
            />
          </v-btn>
        </li>
      </ul>
    </div>

    <!-- ===== ユーザーメニュー ===== -->
    <template #append>
      <div class="admin-user">
        <v-menu location="top start" offset="4">
          <template #activator="{ props: menuProps, isActive }">
            <v-btn
              v-bind="menuProps"
              block
              variant="text"
              class="admin-user__btn"
              :class="{ 'admin-user__btn--rail': isRail }"
            >
              <v-avatar :size="isRail ? 32 : 30" color="rgba(255,255,255,0.2)" class="text-caption">
                {{ username.slice(0, 1) }}
              </v-avatar>
              <template v-if="!isRail">
                <span class="admin-user__name">{{ username }}</span>
                <v-icon
                  icon="mdi-chevron-up"
                  class="admin-user__chevron"
                  :class="{ 'admin-user__chevron--open': isActive }"
                />
              </template>
            </v-btn>
          </template>
          <v-list density="compact" min-width="224">
            <v-list-item
              prepend-icon="mdi-account-cog"
              title="個人スペース"
              @click="go('/personal'); closeOnMobile()"
            />
            <v-list-item
              prepend-icon="mdi-message-outline"
              title="メッセージ"
              @click="feedback.toast(DELAY_APOLOGY)"
            />
            <v-divider />
            <v-list-item
              prepend-icon="mdi-logout"
              title="ログアウト"
              base-color="error"
              @click="onLogout"
            />
          </v-list>
        </v-menu>
      </div>
    </template>
  </v-navigation-drawer>

  <!-- ===== 上部バー ===== -->
  <v-app-bar color="sidebar" height="48" flat>
    <v-app-bar-nav-icon
      size="small"
      aria-label="サイドバーの開閉"
      @click="toggleSidebar"
    />
    <v-spacer />
    <form role="search" class="admin-search" @submit.prevent="onSearch">
      <v-text-field
        v-model="keyword"
        type="text"
        placeholder="検索"
        aria-label="検索"
        enterkeyhint="search"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="solo"
        flat
        bg-color="grey-lighten-4"
        rounded="sm"
        hide-details
      />
    </form>
    <v-btn
      icon
      size="small"
      color="red"
      variant="text"
      aria-label="ログアウト"
      class="mx-1"
      @click="onLogout"
    >
      <v-icon icon="mdi-logout" size="18" />
      <v-tooltip activator="parent" location="bottom" text="ログアウト" />
    </v-btn>
  </v-app-bar>

  <!-- ===== 各画面(ここだけがスクロールする。スクロールバーは出さない) ===== -->
  <v-main class="admin-main">
    <div class="admin-main__scroll">
      <router-view />
    </div>
  </v-main>
</template>

<style scoped>
/* ===== ブランド ===== */
.admin-brand {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 24px 16px;
  border: 0;
  background: #fffff0;
  cursor: pointer;
}
.admin-brand--rail {
  justify-content: center;
  padding: 12px 0;
}
.admin-brand__logo {
  width: 49px;
  height: 49px;
  flex-shrink: 0;
  object-fit: cover;
}
.admin-brand--rail .admin-brand__logo {
  width: 32px;
  height: 32px;
}
.admin-brand__title {
  white-space: nowrap;
  font-size: 1.9rem;
  line-height: 1;
}

/* ===== メインナビ(従来のタブ型デザイン) ===== */
.admin-nav {
  position: relative;
  height: 100%;
  padding: 8px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.admin-nav__stripe {
  pointer-events: none;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 6px;
  background: #fff;
}
.admin-nav__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.admin-nav__item {
  position: relative;
  overflow: visible;
  justify-content: flex-start;
  gap: 12px;
  height: 44px !important;
  padding: 0 0 0 16px !important;
  border-radius: 0;
  color: #fff;
  font-weight: 400;
  letter-spacing: normal;
}
.admin-nav__item :deep(.v-btn__content) {
  justify-content: flex-start;
  gap: 12px;
}
.admin-nav__item--divider {
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}
.admin-nav__item--active {
  background: #fff;
  color: #111827;
  border-radius: 9999px 0 0 9999px;
}
.admin-nav__item--active :deep(.v-btn__overlay) {
  opacity: 0 !important;
}
/* スパンドレル(タブノッチ)。半径はボタンの高さ44px÷2=22px。位置はストライプの左端に合わせる */
.admin-nav__item--active::before,
.admin-nav__item--active::after {
  content: "";
  pointer-events: none;
  position: absolute;
  right: 6px;
  width: 22px;
  height: 22px;
}
.admin-nav__item--active::before {
  top: -22px;
  background: radial-gradient(circle at top left, #111827 22px, #fff 22px);
}
.admin-nav__item--active::after {
  bottom: -22px;
  background: radial-gradient(circle at bottom left, #111827 22px, #fff 22px);
}
/* 折りたたみ時: 小さな角丸アイコンボタン */
.admin-nav__item--rail {
  width: 32px !important;
  height: 32px !important;
  min-width: 0 !important;
  margin: 6px auto;
  padding: 0 !important;
  border-radius: 6px;
  border-top: 0;
}
.admin-nav__item--rail :deep(.v-btn__content) {
  justify-content: center;
}
.admin-nav__item--rail.admin-nav__item--active::before,
.admin-nav__item--rail.admin-nav__item--active::after {
  display: none;
}
.admin-nav__label {
  font-size: 0.875rem;
}

/* ===== ユーザーメニュー ===== */
.admin-user {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.admin-user__btn {
  height: auto !important;
  padding: 8px 16px !important;
  border-radius: 0;
  color: #fff;
  letter-spacing: normal;
}
.admin-user__btn :deep(.v-btn__content) {
  width: 100%;
  gap: 8px;
}
.admin-user__btn--rail {
  padding: 8px 0 !important;
}
.admin-user__btn--rail :deep(.v-btn__content) {
  justify-content: center;
}
.admin-user__name {
  flex: 1;
  text-align: left;
  font-size: 0.9rem;
}
.admin-user__chevron {
  transition: transform 0.2s;
}
.admin-user__chevron--open {
  transform: rotate(180deg);
}

/* ===== 上部バー ===== */
.admin-search {
  width: 176px;
  min-width: 0;
}
@media (min-width: 600px) {
  .admin-search {
    width: 240px;
  }
}
.admin-search :deep(.v-field) {
  --v-input-control-height: 32px;
  font-size: 0.875rem;
}
.admin-search :deep(.v-field__input) {
  min-height: 32px;
  padding-top: 0;
  padding-bottom: 0;
}

/* ===== メインエリア ===== */
.admin-main {
  height: 100dvh;
}
.admin-main__scroll {
  height: 100%;
  overflow-y: auto;
  padding: 3px;
  scrollbar-width: none;
}
.admin-main__scroll::-webkit-scrollbar {
  display: none;
}
</style>
