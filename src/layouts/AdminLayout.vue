<script setup lang="ts">
// src/layouts/AdminLayout.vue
// ログイン後の画面の共通レイアウト(旧 (admin)/layout.tsx)。
//  - ログイン確認・未保存の確認は router/guards.ts が受け持つ
//  - ログイン状態の定期確認は useSessionCheck()
// サイドバー: デスクトップは折りたたみ可能(アイコンのみ表示、Ctrl/⌘+B でも切替)、
// モバイル(768px未満)は左から出るドロワー。折りたたみ状態は localStorage に保存して次回も復元する。
// 画面全体の高さを固定し、スクロールは右側のメインエリア内だけに閉じ込める。
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import "@/plugins/fonts/logo";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { useFeedbackStore } from "@/stores/feedback";
import { confirmDiscardUnsaved } from "@/router/guards";
import { hardRedirectHome } from "@/lib/session";
import { DELAY_APOLOGY, EMPTY_STRING, extractMessage } from "@/lib/constants";
import { useIsMobile } from "@/composables/useIsMobile";
import { useSessionCheck } from "@/composables/useSessionCheck";
import JerusalemCross from "@/components/JerusalemCross.vue";

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
const onNav = (item: NavItem) => {
  item.action();
  closeOnMobile();
};

// ===== ログアウト =====
const loggingOut = ref(false);
const onLogout = async () => {
  if (loggingOut.value) return;
  // 先にログアウトするかを聞き、そのあとで未保存の破棄・プレイリスト作成の中止を確認する
  // (作成の中止は取り消せないので、ログアウトをやめる余地が残っている間には行わない)
  const ok = await feedback.confirm("ログアウトしますか。", "警告");
  if (!ok || loggingOut.value) return;
  if (!(await confirmDiscardUnsaved())) return;
  if (loggingOut.value) return;
  loggingOut.value = true;
  try {
    await auth.logout();
  } catch (e: unknown) {
    feedback.toast(
      extractMessage(e, "ログアウトに失敗しました。もう一度お試しください。"),
    );
    return;
  } finally {
    loggingOut.value = false;
  }
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
  <!-- サイドバー: 項目は Vuetify の v-list-item(ホバーで薄い背景、押すと波紋)。
       選択中の項目は左端の臙脂の線と濃い背景で示す -->
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
        <JerusalemCross :size="isRail ? 33 : 44" />
        <span v-if="!isRail" class="effect-shine admin-brand__title"
          >NASB1995</span
        >
      </button>
    </template>

    <!-- ===== メインナビ ===== -->
    <v-list bg-color="transparent" class="admin-nav" aria-label="メニュー">
      <v-list-item
        v-for="item in navItems"
        :key="item.key"
        :prepend-icon="item.icon"
        :title="item.title"
        :active="item.isActive"
        :aria-current="item.isActive ? 'page' : undefined"
        rounded="0"
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
                <v-avatar size="30" color="#374151" class="admin-user__avatar">
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
  <v-app-bar color="sidebar" height="48" flat class="admin-bar">
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
      color="#4c0014"
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
  border-right: 0;
  --v-medium-emphasis-opacity: 0.8;
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
  border-bottom: 1px solid #1e293b;
  background: transparent;
  cursor: pointer;
}
/* 管理画面のロゴ(十字・文字)はクリーム色にする */
.admin-brand :deep(.jerusalem-cross),
.admin-brand .admin-brand__title {
  color: #f3e3c3;
}
.admin-brand--rail {
  justify-content: center;
  padding: 12px 0;
}
.admin-brand__title {
  white-space: nowrap;
  font-size: 1.75rem;
  line-height: 1;
}

/* ===== メインナビ ===== */
.admin-nav {
  padding-block: 8px;
  color: rgb(var(--v-theme-on-sidebar));
}
.admin-nav__item {
  min-height: 44px;
  /* 選択中の左の線(3px)と同じ幅を、選んでいない項目にも透明で取って文字の位置をそろえる */
  border-left: 3px solid transparent;
  padding-inline-start: 13px !important;
}
.admin-nav__item :deep(.v-list-item-title) {
  font-size: 0.9rem;
  letter-spacing: normal;
}
/* アイコンと文字の間を詰める(既定は 32px) */
.admin-nav__item :deep(.v-list-item__spacer) {
  width: 14px !important;
}
/* 選択中: 左端に臙脂の線、濃い背景、白い文字(Vuetify の選択の重ねは消す) */
.admin-nav__item.v-list-item--active {
  border-left-color: #c43c5a;
  background: #1e293b;
  color: #fff;
  font-weight: 600;
}
.admin-nav__item.v-list-item--active :deep(.v-list-item__overlay) {
  opacity: 0;
}

/* ===== ユーザーメニュー ===== */
.admin-user {
  padding: 8px;
  border-top: 1px solid #1e293b;
}
.admin-user__avatar {
  font-size: 0.8rem;
  color: #e5e7eb;
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
.admin-bar {
  border-bottom: 1px solid #1e293b;
}
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
