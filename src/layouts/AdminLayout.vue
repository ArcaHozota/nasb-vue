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
  /** 見出し(聖書・賛美歌・その他)。同じ見出しの項目を続けて並べる */
  group: string;
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
      group: "聖書",
      icon: "mdi-anchor",
      title: "聖書章節選択",
      action: () => feedback.toast(DELAY_APOLOGY),
      // 実ページが無い(トースト表示のみ)ため、アクティブ判定の対象外
      isActive: false,
    },
    {
      key: "bookAdd",
      group: "聖書",
      icon: "mdi-package-variant-closed",
      title: "聖書章節入力",
      action: () => go("/books/add"),
      isActive: path === "/books/add",
    },
    {
      key: "hymns",
      group: "賛美歌",
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
      group: "賛美歌",
      icon: "mdi-shuffle-variant",
      title: "ランダム検索",
      action: () => go("/hymns/random-five"),
      isActive: path.startsWith("/hymns/random-five"),
    },
    {
      key: "receipts",
      group: "その他",
      icon: "mdi-receipt-text-outline",
      title: "レシート明細入力",
      // /receipts のページはまだ無いため「未実装」のトーストだけ出す。
      action: () => feedback.toast(DELAY_APOLOGY),
      isActive: false,
    },
  ];
});
/** 見出しは、グループの最初の項目の前にだけ出す */
const startsGroup = (idx: number) =>
  idx === 0 || navItems.value[idx].group !== navItems.value[idx - 1].group;

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
  <!-- サイドバー: クリーム地＋臙脂(PC版ホームと同じ色)。項目は Vuetify の v-list nav
       (ホバーで薄い背景、押すと波紋、選択中は臙脂の薄い角丸) -->
  <v-navigation-drawer
    v-model="drawer"
    :rail="isRail"
    rail-width="56"
    width="256"
    color="sidebar"
    class="admin-sidebar"
  >
    <!-- ===== ブランド ===== -->
    <template #prepend>
      <button
        v-ripple
        type="button"
        class="admin-brand"
        :class="{ 'admin-brand--rail': isRail }"
        aria-label="メインメニューへ"
        @click="
          go('/mainmenu');
          closeOnMobile();
        "
      >
        <img
          src="/assets/jerusalem-cross2.svg"
          alt=""
          class="admin-brand__logo"
        />
        <span v-if="!isRail" class="effect-shine admin-brand__title"
          >NASB1995</span
        >
      </button>
    </template>

    <!-- ===== メインナビ ===== -->
    <v-list nav color="primary" class="admin-nav" aria-label="メニュー">
      <template v-for="(item, idx) in navItems" :key="item.key">
        <template v-if="startsGroup(idx)">
          <v-list-subheader v-if="!isRail" class="admin-nav__group">{{
            item.group
          }}</v-list-subheader>
          <v-divider v-else-if="idx > 0" class="my-2" />
        </template>
        <v-list-item
          :prepend-icon="item.icon"
          :title="item.title"
          :active="item.isActive"
          :aria-current="item.isActive ? 'page' : undefined"
          rounded="lg"
          class="admin-nav__item"
          @click="onNav(item)"
        >
          <v-tooltip
            activator="parent"
            location="end"
            :disabled="!isRail"
            :text="item.title"
          />
        </v-list-item>
      </template>
    </v-list>

    <!-- ===== ユーザーメニュー ===== -->
    <template #append>
      <div class="admin-user">
        <v-menu location="top start" offset="4">
          <template #activator="{ props: menuProps, isActive }">
            <v-list-item
              v-bind="menuProps"
              rounded="lg"
              class="admin-user__btn"
              :aria-label="isRail ? username : undefined"
            >
              <template #prepend>
                <v-avatar size="30" color="#efe6d3" class="admin-user__avatar">
                  {{ username.slice(0, 1) }}
                </v-avatar>
              </template>
              <v-list-item-title v-if="!isRail" class="admin-user__name">{{
                username
              }}</v-list-item-title>
              <template v-if="!isRail" #append>
                <v-icon
                  icon="mdi-chevron-up"
                  size="20"
                  class="admin-user__chevron"
                  :class="{ 'admin-user__chevron--open': isActive }"
                />
              </template>
            </v-list-item>
          </template>
          <v-list density="compact" min-width="224">
            <v-list-item
              prepend-icon="mdi-account-cog"
              title="個人スペース"
              @click="
                go('/personal');
                closeOnMobile();
              "
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
  <v-app-bar color="sidebar" height="48" flat border="b">
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
/* ===== サイドバー ===== */
.admin-sidebar {
  border-right: 1px solid #ece4d3;
}

/* ===== ブランド ===== */
.admin-brand {
  position: relative;
  overflow: hidden;
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  border: 0;
  border-bottom: 1px solid #ece4d3;
  background: transparent;
  cursor: pointer;
}
.admin-brand--rail {
  justify-content: center;
  padding: 12px 0;
}
.admin-brand__logo {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  object-fit: cover;
}
.admin-brand--rail .admin-brand__logo {
  width: 32px;
  height: 32px;
}
.admin-brand__title {
  white-space: nowrap;
  font-size: 1.75rem;
  line-height: 1;
}

/* ===== メインナビ ===== */
.admin-nav {
  padding-top: 4px;
  color: #3f3328;
}
.admin-nav__group {
  min-height: 32px;
  padding-inline-start: 12px !important;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: #9a8b74;
}
.admin-nav__item {
  min-height: 42px;
}
.admin-nav__item :deep(.v-list-item-title) {
  font-size: 0.9rem;
  letter-spacing: normal;
}
/* アイコンと文字の間を詰める(既定は 32px) */
.admin-nav__item :deep(.v-list-item__spacer) {
  width: 14px !important;
}
/* 選択中: 臙脂の文字＋薄い臙脂の背景(Vuetify の選択の重ねを少し濃く) */
.admin-nav__item.v-list-item--active {
  font-weight: 600;
}
.admin-nav__item.v-list-item--active :deep(.v-list-item__overlay) {
  opacity: 0.1;
}

/* ===== ユーザーメニュー ===== */
.admin-user {
  padding: 8px;
  border-top: 1px solid #ece4d3;
}
.admin-user__avatar {
  font-size: 0.8rem;
  color: #5a4630;
}
.admin-user__name {
  font-size: 0.9rem;
  font-weight: 500;
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
