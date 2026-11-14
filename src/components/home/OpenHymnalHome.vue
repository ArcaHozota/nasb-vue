<script setup lang="ts">
// PC版ホーム画面「開いた讃美歌集」(旧 components/home/OpenHymnalHome.tsx)。
//   左ページ: 讃美歌集の目次(番号・点線・◆の数で一致度)。1ページ11曲。
//   右ページ: 左で選んだ曲(HymnBookPage)。
// データ取得・検索・ページ送りの状態は HomeView.vue が持つ。
import { computed, ref, watch } from "vue";
import type { HymnSummary } from "@/api/hymns";
import HymnBookPage from "@/components/home/HymnBookPage.vue";
import { hymnNo, matchOf } from "./match";

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
// ページや検索が変わったら目次の先頭へ
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

// ↑↓キーで目次の曲を移動する
const list = ref<HTMLOListElement | null>(null);
const onListKeyDown = (e: KeyboardEvent) => {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  const next = Math.min(
    props.records.length - 1,
    Math.max(0, selectedIndex.value + (e.key === "ArrowDown" ? 1 : -1)),
  );
  selectedId.value = props.records[next]?.id ?? null;
  const rows = list.value?.querySelectorAll<HTMLButtonElement>(
    "button[data-hymn-row]",
  );
  rows?.[next]?.focus();
};

const firstLoad = computed(
  () => props.isFetching && props.records.length === 0,
);
const caption = computed(() => {
  const kw = props.submittedKeyword.trim();
  if (!kw) return `賛美歌 ・ ${props.totalRecords}曲`;
  if (props.hitCount === undefined)
    return `「${kw}」を含む賛美歌 ・ ${props.totalRecords}曲`;
  return props.hitCount > 0
    ? `「${kw}」に近い賛美歌 ・ ${props.hitCount}曲(全${props.totalRecords}曲)`
    : `賛美歌 ・ ${props.totalRecords}曲`;
});
const rowMatch = (line: string) =>
  props.terms.length > 0 ? matchOf(line) : null;
</script>

<template>
  <div class="open-hymnal">
    <header class="open-hymnal-header">
      <!-- ロゴは Vuetify の v-btn(ホバーで薄い背景、押すと波紋) -->
      <v-btn
        variant="text"
        rounded="lg"
        class="open-hymnal__brand"
        aria-label="ホーム(検索をリセット)"
        @click="emit('reload')"
      >
        <svg viewBox="0 0 66 66" class="open-hymnal__cross" aria-hidden="true">
          <g fill="currentColor">
            <rect x="27" y="4" width="12" height="58" />
            <rect x="4" y="27" width="58" height="12" />
            <rect x="15" y="9" width="3" height="13" />
            <rect x="10" y="14" width="13" height="3" />
            <rect x="48" y="9" width="3" height="13" />
            <rect x="43" y="14" width="13" height="3" />
            <rect x="15" y="44" width="3" height="13" />
            <rect x="10" y="49" width="13" height="3" />
            <rect x="48" y="44" width="3" height="13" />
            <rect x="43" y="49" width="13" height="3" />
          </g>
        </svg>
        <span class="open-hymnal-logo">NASB1995</span>
      </v-btn>

      <!-- 下線だけの検索欄(暗いヘッダー用)。<form> にして Enter での送信をブラウザに任せる -->
      <form
        role="search"
        class="open-hymnal__search"
        @submit.prevent="emit('search')"
      >
        <span class="open-hymnal__search-label">索引</span>
        <input
          v-model="keyword"
          type="text"
          placeholder="曲名・歌詞のキーワードで検索してください"
          aria-label="キーワード"
          class="noto-serif-kr open-hymnal__search-input"
        />
        <v-btn
          type="submit"
          icon
          size="x-small"
          variant="text"
          aria-label="検索"
          class="open-hymnal__search-btn"
        >
          <v-progress-circular
            v-if="isFetching"
            indeterminate
            size="14"
            width="2"
          />
          <v-icon v-else icon="mdi-magnify" size="16" />
        </v-btn>
      </form>

      <v-btn
        variant="outlined"
        prepend-icon="mdi-login"
        class="open-hymnal__login"
        @click="emit('login')"
      >
        ログイン
      </v-btn>
    </header>

    <main class="open-hymnal-main">
      <div class="book">
        <!-- ===== 左ページ: 目次 ===== -->
        <section class="book-page book-page--left" aria-label="目次">
          <p class="book-caption">{{ caption }}</p>
          <p v-if="notice" role="status" class="book-sans open-hymnal__notice">
            {{ notice }}
          </p>
          <ol
            ref="list"
            :class="[
              'open-hymnal__toc',
              { 'is-stale': isFetching && records.length > 0 },
            ]"
            @keydown="onListKeyDown"
          >
            <template v-if="firstLoad">
              <li
                v-for="i in pageSize"
                :key="i"
                class="toc-row toc-row--skeleton"
              >
                <v-skeleton-loader
                  type="text"
                  width="28"
                  class="bg-transparent"
                />
                <span class="d-flex flex-column flex-grow-1">
                  <v-skeleton-loader
                    type="text"
                    width="75%"
                    class="bg-transparent"
                  />
                </span>
              </li>
            </template>
            <li
              v-if="!isFetching && records.length === 0"
              class="book-sans open-hymnal__empty"
            >
              <v-icon
                icon="mdi-book-open-variant"
                size="32"
                aria-hidden="true"
              />
              <span class="text-title-medium font-weight-bold"
                >該当データなし</span
              >
              <span class="text-body-medium"
                >別のキーワードで検索してください。</span
              >
            </li>
            <li v-for="(r, i) in records" :key="r.id">
              <!-- 押すと Vuetify の波紋(v-ripple)が出る -->
              <button
                v-ripple
                type="button"
                data-hymn-row
                :data-active="i === selectedIndex"
                :aria-current="i === selectedIndex ? 'true' : undefined"
                class="toc-row toc-row--btn"
                @click="selectedId = r.id"
              >
                <span class="toc-row__no">{{ hymnNo(page, pageSize, i) }}</span>
                <span class="toc-row__body">
                  <span class="toc-row__line">
                    <span class="toc-row__jp">{{ r.nameJp }}</span>
                    <span class="toc-row__dots" aria-hidden="true" />
                    <span
                      v-if="rowMatch(r.lineNumber)"
                      :class="['toc-row__match', rowMatch(r.lineNumber)!.tone]"
                      :aria-label="rowMatch(r.lineNumber)!.label"
                    >
                      {{ rowMatch(r.lineNumber)!.mark }}
                    </span>
                  </span>
                  <span class="noto-serif-kr toc-row__kr">{{ r.nameKr }}</span>
                </span>
              </button>
            </li>
          </ol>
          <nav class="book-pager" aria-label="ページ送り">
            <!-- Vuetify の v-btn(ホバーで薄い背景、押すと波紋)。本のデザインに合わせて文字だけのボタンにする -->
            <v-btn
              variant="text"
              color="primary"
              size="small"
              density="comfortable"
              rounded="pill"
              class="open-hymnal__pager-btn"
              :disabled="page <= 1"
              @click="emit('update:page', page - 1)"
            >
              ← 前
            </v-btn>
            <span aria-live="polite">{{ page }} / {{ totalPages }}</span>
            <v-btn
              variant="text"
              color="primary"
              size="small"
              density="comfortable"
              rounded="pill"
              class="open-hymnal__pager-btn"
              :disabled="page >= totalPages"
              @click="emit('update:page', page + 1)"
            >
              次 →
            </v-btn>
          </nav>
        </section>

        <!-- ===== 右ページ: 選んだ曲 ===== -->
        <HymnBookPage
          v-if="selected"
          :key="selected.id"
          :hymn="selected"
          :no="hymnNo(page, pageSize, selectedIndex)"
          :terms="terms"
          :download="download"
        />
        <article
          v-else
          class="book-page book-page--right open-hymnal__placeholder"
        >
          <v-progress-circular
            v-if="firstLoad"
            indeterminate
            size="24"
            width="2"
            color="primary"
          />
          <span v-else class="book-sans text-body-medium"
            >左の目次から曲を選んでください。</span
          >
        </article>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ホバーの背景のための余白を取り、そのぶん左へずらしてロゴの位置は今まで通りにする */
.open-hymnal__brand {
  height: auto !important;
  margin-left: -10px;
  padding: 6px 10px !important;
  color: #f3e3c3;
  letter-spacing: normal;
}
.open-hymnal__brand :deep(.v-btn__content) {
  gap: 10px;
}
.open-hymnal__cross {
  width: 36px;
  height: 36px;
}
.open-hymnal__search {
  display: flex;
  align-items: center;
  width: min(420px, 40vw);
  padding: 6px 2px;
  border-bottom: 1px solid rgba(243, 227, 195, 0.6);
  color: #f3e3c3;
}
.open-hymnal__search:focus-within {
  border-bottom-color: #f3e3c3;
}
.open-hymnal__search-label {
  flex-shrink: 0;
  font-size: 13px;
  color: rgba(243, 227, 195, 0.85);
}
.open-hymnal__search-input {
  flex: 1;
  min-width: 0;
  padding: 0 8px;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 1rem;
  color: #fff;
}
.open-hymnal__search-input::placeholder {
  font-family: "Noto Sans JP", sans-serif;
  font-size: 13px;
  color: rgba(243, 227, 195, 0.55);
}
.open-hymnal__search-btn {
  color: #f3e3c3;
}
.open-hymnal__login {
  height: 34px !important;
  border-color: #f3e3c3;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: normal;
  color: #f3e3c3;
}
.open-hymnal__notice {
  padding: 0 4px 4px;
  font-size: 0.75rem;
  color: #8a6400;
}
/* 画面が低くて11曲が収まらない時は、ページ送りをページの外へ押し出さず、目次の中でスクロールする */
.open-hymnal__toc {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  margin: 0;
  padding: 0;
  list-style: none;
  transition: opacity 0.15s;
}
.open-hymnal__toc.is-stale {
  opacity: 0.5;
}
.open-hymnal__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin: auto;
  padding: 40px 0;
  text-align: center;
  color: #6b5338;
}
/* 目次の1行(点線の下罫線・押せる行のホバーと選択中の背景は本のデザインに合わせる) */
.toc-row {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: baseline;
  gap: 12px;
  width: 100%;
  padding: 8.7px 8px;
  border: 0;
  border-bottom: 1px dotted #c9b48d;
  background: transparent;
  font-size: 1rem;
  line-height: 1.5;
  text-align: left;
  color: inherit;
}
.toc-row--btn:hover {
  background: #f3e8cf;
}
.toc-row--btn[data-active="true"] {
  background: #efe2c4;
}
.toc-row--btn:focus-visible {
  outline: 2px solid #800020;
  outline-offset: -2px;
}
/* 番号は曲名とベースラインでそろえる。行の高さを曲名(22.5px)と同じにして、行が無駄に高くならないようにする
   (27px だと番号の上に余白ができ、11曲が本のページに収まらなかった) */
.toc-row__no {
  width: 30px;
  flex-shrink: 0;
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 22.5px;
  color: #800020;
}
.toc-row__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.toc-row__line {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.toc-row__jp {
  overflow: hidden;
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.toc-row__dots {
  flex: 1;
  min-width: 12px;
  translate: 0 -4px;
  border-bottom: 2px dotted #c9b48d;
}
.toc-row__match {
  flex-shrink: 0;
  font-size: 11px;
  letter-spacing: 1px;
}
.toc-row__kr {
  overflow: hidden;
  font-size: 0.75rem;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #5a4630;
}
.open-hymnal__pager-btn {
  font-size: 13px;
  letter-spacing: normal;
}
.open-hymnal__placeholder {
  align-items: center;
  justify-content: center;
  color: #8a7a64;
}
.tone-cadmium {
  color: #0d5c33;
}
.tone-burgundy {
  color: #800020;
}
.tone-naples {
  color: #8a6400;
}
.tone-related {
  color: #8a7a64;
}
</style>
