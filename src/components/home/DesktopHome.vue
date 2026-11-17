<script setup lang="ts">
// PC版ホーム画面。上にヘッダー(ロゴ・検索・ログイン)、下に左右2つのカード。
//   左: 曲の一覧(一致度の丸・曲名・韓国語名・一致度)。1ページ10曲。
//   右: 左で選んだ曲の詳細(HymnDetail)。
// データ取得・検索・ページ送りの状態は HomeView.vue が持つ。
import { computed, ref, watch } from "vue";
import type { HymnSummary } from "@/api/hymns";
import HymnDetail from "@/components/home/HymnDetail.vue";
import JerusalemCross from "@/components/JerusalemCross.vue";
import HymnListRow from "@/components/home/HymnListRow.vue";
import { hymnNo } from "./match";

const props = defineProps<{
  records: HymnSummary[];
  totalRecords: number;
  page: number;
  totalPages: number;
  pageSize: number;
  isFetching: boolean;
  submittedKeyword: string;
  terms: string[];
  /** 画面側検索で一致した曲数(サーバー検索のときは未指定) */
  hitCount?: number;
  /** 画面側検索で一致が無かったときの案内 */
  notice?: string | null;
  download: (id: string, chord?: string) => Promise<void>;
}>();
const keyword = defineModel<string>("keyword", { required: true });
const emit = defineEmits<{
  search: [];
  reload: [];
  login: [];
  "update:page": [page: number];
}>();

// 選んだ曲。ページや検索が変わってその曲が一覧に無くなったら、先頭の曲を表示する
const selectedId = ref<string | null>(null);
watch(
  () => `${props.page}|${props.submittedKeyword}`,
  () => {
    selectedId.value = null;
  },
);
const selectedIndex = computed(() =>
  Math.max(
    0,
    props.records.findIndex((r) => r.id === selectedId.value),
  ),
);
const selected = computed(() => props.records[selectedIndex.value]);

// ↑↓キーで一覧の曲を移動する
const list = ref<{ $el: HTMLElement } | null>(null);
const onListKeyDown = (e: KeyboardEvent) => {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  const next = Math.min(
    props.records.length - 1,
    Math.max(0, selectedIndex.value + (e.key === "ArrowDown" ? 1 : -1)),
  );
  selectedId.value = props.records[next]?.id ?? null;
  const rows = list.value?.$el.querySelectorAll<HTMLElement>("[data-hymn-row]");
  rows?.[next]?.focus();
};

const searching = computed(() => props.terms.length > 0);
const firstLoad = computed(
  () => props.isFetching && props.records.length === 0,
);
const caption = computed(() => {
  if (!props.submittedKeyword.trim()) return `${props.totalRecords}件`;
  if (props.hitCount === 0) return `${props.totalRecords}件`;
  if (props.hitCount !== undefined)
    return `${props.hitCount}件(全${props.totalRecords}件) ・ 一致度の高い順`;
  return `${props.totalRecords}件 ・ 一致度の高い順`;
});
</script>

<template>
  <div class="desktop-home">
    <header class="desktop-home__bar">
      <!-- ロゴは Vuetify の v-btn(ホバーで薄い背景、押すと波紋)。押すと検索をリセットする -->
      <v-btn
        variant="text"
        rounded="lg"
        class="desktop-home__brand"
        aria-label="ホーム(検索をリセット)"
        @click="emit('reload')"
      >
        <JerusalemCross :size="33" />
        <span class="desktop-home__logo">NASB1995</span>
      </v-btn>

      <!-- 検索欄。<form> にして Enter での送信(日本語変換中の Enter は除く)をブラウザに任せる -->
      <form
        role="search"
        class="desktop-home__search"
        @submit.prevent="emit('search')"
      >
        <v-text-field
          v-model="keyword"
          variant="outlined"
          rounded="pill"
          density="comfortable"
          hide-details
          single-line
          bg-color="white"
          base-color="#d9cfbc"
          color="primary"
          placeholder="曲名・歌詞のキーワードで検索してください"
          aria-label="キーワード"
          class="noto-serif-kr"
        >
          <template #prepend-inner>
            <v-progress-circular
              v-if="isFetching"
              indeterminate
              size="18"
              width="2"
              color="primary"
            />
            <v-icon
              v-else
              icon="mdi-magnify"
              size="20"
              class="desktop-home__search-icon"
            />
          </template>
        </v-text-field>
      </form>

      <v-btn
        color="warning"
        variant="flat"
        size="large"
        rounded="lg"
        class="desktop-home__login"
        @click="emit('login')"
      >
        ログイン
      </v-btn>
    </header>

    <main class="desktop-home__main">
      <!-- ===== 左: 曲の一覧 ===== -->
      <v-card
        flat
        rounded="xl"
        class="desktop-home__card desktop-home__list-card"
        aria-label="曲の一覧"
        tag="section"
      >
        <div class="desktop-home__caption">{{ caption }}</div>
        <p v-if="notice" role="status" class="desktop-home__notice">
          {{ notice }}
        </p>

        <div v-if="firstLoad" class="desktop-home__scroll">
          <v-skeleton-loader
            v-for="i in pageSize"
            :key="i"
            type="list-item-two-line"
            class="desktop-home__skeleton"
          />
        </div>
        <v-empty-state
          v-else-if="!isFetching && records.length === 0"
          icon="mdi-magnify-close"
          title="該当データなし"
          text="別のキーワードで検索してください。"
          class="desktop-home__empty"
        />
        <v-list
          v-else
          ref="list"
          :class="[
            'desktop-home__scroll py-0',
            { 'is-stale': isFetching && records.length > 0 },
          ]"
          bg-color="transparent"
          @keydown="onListKeyDown"
        >
          <HymnListRow
            v-for="(r, i) in records"
            :key="r.id"
            :hymn="r"
            :no="hymnNo(page, pageSize, i)"
            :searching="searching"
            :active="i === selectedIndex"
            @click="selectedId = r.id"
          />
        </v-list>

        <nav class="desktop-home__pager" aria-label="ページ送り">
          <v-btn
            variant="text"
            prepend-icon="mdi-chevron-left"
            class="desktop-home__pager-btn"
            :disabled="page <= 1"
            @click="emit('update:page', page - 1)"
          >
            前
          </v-btn>
          <span aria-live="polite">{{ page }} / {{ totalPages }}</span>
          <v-btn
            variant="text"
            color="primary"
            append-icon="mdi-chevron-right"
            class="desktop-home__pager-btn"
            :disabled="page >= totalPages"
            @click="emit('update:page', page + 1)"
          >
            次
          </v-btn>
        </nav>
      </v-card>

      <!-- ===== 右: 選んだ曲 ===== -->
      <HymnDetail
        v-if="selected"
        :key="selected.id"
        :hymn="selected"
        :terms="terms"
        :download="download"
      />
      <v-card
        v-else
        flat
        rounded="xl"
        class="desktop-home__card desktop-home__placeholder"
      >
        <v-progress-circular
          v-if="firstLoad"
          indeterminate
          size="24"
          width="2"
          color="primary"
        />
        <span v-else class="text-body-medium"
          >左の一覧から曲を選んでください。</span
        >
      </v-card>
    </main>
  </div>
</template>

<style scoped>
.desktop-home {
  display: flex;
  flex-direction: column;
  min-height: 100svh;
  background: #f4f0e7;
  color: #2b1d14;
  font-family: "Noto Sans JP", sans-serif;
}

/* ===== ヘッダー ===== */
.desktop-home__bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 24px;
  height: 64px;
  padding: 0 32px 0 24px;
  border-bottom: 1px solid #e8e0cf;
  background: #fdfaf2;
}
.desktop-home__brand {
  height: auto !important;
  padding: 6px 10px !important;
  color: #800020;
  letter-spacing: normal;
}
.desktop-home__brand :deep(.v-btn__content) {
  gap: 10px;
}
.desktop-home__logo {
  font-family: "Niconne", cursive;
  font-size: 26px;
  line-height: 1;
  text-transform: none;
}
.desktop-home__search {
  width: min(400px, 36vw);
}
.desktop-home__search-icon {
  color: #6b5d4a;
}
.desktop-home__login {
  margin-left: auto;
  padding: 0 20px !important;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #2b1d14 !important;
}

/* ===== 左右のカード ===== */
/* 左右のカードを並べた面(ブック)。幅 1190px・高さ 740px で、ヘッダーの下の余白の中央に置く
   (画面がそれより狭いときは幅を縮め、低いときはページ全体をスクロールする) */
.desktop-home__main {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: minmax(320px, 36fr) 64fr;
  gap: 16px;
  width: min(1190px, 100% - 48px);
  height: 740px;
  margin: auto;
  padding-block: 16px;
  box-sizing: content-box;
}
.desktop-home__card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid #e8e0cf;
}
.desktop-home__caption {
  flex-shrink: 0;
  padding: 14px 24px;
  border-bottom: 1px solid #efe8da;
  font-size: 0.8125rem;
  color: #6b5d4a;
}
.desktop-home__notice {
  padding: 8px 24px 0;
  font-size: 0.75rem;
  color: #8a6400;
}
/* 念のため、10曲が収まらない時は、ページ送りを押し出さず一覧の中でスクロールする */
.desktop-home__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  transition: opacity 0.15s;
}
.desktop-home__scroll.is-stale {
  opacity: 0.5;
}
.desktop-home__skeleton {
  border-bottom: 1px solid #efe8da;
}
.desktop-home__empty {
  flex: 1;
  color: #6b5d4a;
}

/* ページ送り */
.desktop-home__pager {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-top: 1px solid #efe8da;
  font-size: 0.875rem;
  color: #6b5d4a;
}
.desktop-home__pager-btn {
  letter-spacing: normal;
}
.desktop-home__placeholder {
  align-items: center;
  justify-content: center;
  color: #8a7a64;
}
</style>
