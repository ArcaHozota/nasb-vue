<script setup lang="ts">
// モバイル版ホーム画面(PC版と同じクリーム地・白いカード・臙脂)。
//   一覧: 曲を縦に並べ、下までフリックすると次の曲を自動で読み足す(v-infinite-scroll)。
//   詳細: 曲を押すと下からシート(v-bottom-sheet)で出る。左右にスワイプで前後の曲へ(v-window)、
//         上の取っ手を下へスワイプ・背景を押す・×で閉じる。中身は PC版と同じ HymnDetail(compact)。
// データ取得・検索の状態は HomeView.vue が持つ。
import { computed, ref, watch } from "vue";
import type { HymnSummary } from "@/api/hymns";
import JerusalemCross from "@/components/JerusalemCross.vue";
import HymnDetail from "@/components/home/HymnDetail.vue";
import HymnListRow from "@/components/home/HymnListRow.vue";
import { hymnNo } from "./match";

const props = defineProps<{
  /** 読み込み済みの曲(先頭から) */
  records: HymnSummary[];
  totalRecords: number;
  isFetching: boolean;
  /** まだ読み込んでいない曲があるか */
  hasMore: boolean;
  /** 次の曲を読み足す。読み足したあとも残りがあれば true */
  loadMore: () => Promise<boolean>;
  submittedKeyword: string;
  terms: string[];
  /** 画面側検索で一致した曲数(サーバー検索のときは未指定) */
  hitCount?: number;
  /** 画面側検索で一致が無かったときの案内 */
  notice?: string | null;
  download: (id: string, chord?: string) => Promise<void>;
}>();
const keyword = defineModel<string>("keyword", { required: true });
const emit = defineEmits<{ search: []; reload: [] }>();

// 詳細シートを開く前に、この件数まで近づいたら次の曲を先に読み足しておく
const PREFETCH_REMAINING = 3;

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

// ===== 一覧: 下までフリックしたら読み足す =====
type LoadStatus = "ok" | "empty" | "error";
const onLoad = async ({ done }: { done: (s: LoadStatus) => void }) => {
  if (!props.hasMore) return done("empty");
  try {
    done((await props.loadMore()) ? "ok" : "empty");
  } catch {
    done("error");
  }
};

// ===== 詳細シート =====
const sheetOpen = ref(false);
const sheetIndex = ref(0);
const open = (i: number) => {
  sheetIndex.value = i;
  sheetOpen.value = true;
};
// 検索し直したら閉じる(一覧が入れ替わるため)
watch(
  () => props.submittedKeyword,
  () => {
    sheetOpen.value = false;
  },
);
// スワイプで最後の方まで来たら、次の曲を先に読み足す
watch(sheetIndex, (i) => {
  if (props.hasMore && i >= props.records.length - PREFETCH_REMAINING) {
    void props.loadMore().catch(() => undefined);
  }
});
const current = computed(() => props.records[sheetIndex.value]);

// 上の取っ手を下へスワイプしたら閉じる
let touchStartY: number | null = null;
const onHandleTouchStart = (e: TouchEvent) => {
  touchStartY = e.touches[0]?.clientY ?? null;
};
const onHandleTouchEnd = (e: TouchEvent) => {
  const endY = e.changedTouches[0]?.clientY;
  if (touchStartY !== null && endY !== undefined && endY - touchStartY > 60) {
    sheetOpen.value = false;
  }
  touchStartY = null;
};

const onSearch = () => {
  window.scrollTo({ top: 0 });
  emit("search");
};
</script>

<template>
  <div class="mobile-home">
    <header class="mobile-home__bar">
      <!-- ロゴは Vuetify の v-btn(押すと波紋)。押すと検索をリセットする -->
      <v-btn
        variant="text"
        rounded="lg"
        class="mobile-home__brand"
        aria-label="ホーム(検索をリセット)"
        @click="emit('reload')"
      >
        <JerusalemCross :size="30" />
        <span class="mobile-home__logo">NASB1995</span>
      </v-btn>
      <!-- 管理画面はモバイルではログインできない仕様のため、ログインボタンは置かない -->
    </header>

    <main class="mobile-home__main">
      <!-- 検索欄。<form> にして Enter での送信(日本語変換中の Enter は除く)をブラウザに任せる -->
      <form role="search" @submit.prevent="onSearch">
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
          enterkeyhint="search"
          placeholder="曲名・歌詞のキーワードで検索"
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
              class="mobile-home__icon"
            />
          </template>
        </v-text-field>
      </form>

      <p class="mobile-home__caption">{{ caption }}</p>
      <p v-if="notice" role="status" class="mobile-home__notice">
        {{ notice }}
      </p>

      <v-card
        flat
        rounded="xl"
        class="mobile-home__card"
        aria-label="曲の一覧"
        tag="section"
      >
        <template v-if="firstLoad">
          <v-skeleton-loader
            v-for="i in 6"
            :key="i"
            type="list-item-two-line"
            class="mobile-home__skeleton"
          />
        </template>
        <v-empty-state
          v-else-if="!isFetching && records.length === 0"
          icon="mdi-magnify-close"
          title="該当データなし"
          text="別のキーワードで検索してください。"
          class="mobile-home__empty"
        />
        <!-- 下までフリックすると次の曲を読み足す。検索し直したら作り直して「最後まで読んだ」状態を戻す -->
        <v-infinite-scroll
          v-else
          :key="submittedKeyword"
          side="end"
          margin="300"
          class="mobile-home__infinite"
          @load="onLoad"
        >
          <v-list bg-color="transparent" class="py-0">
            <HymnListRow
              v-for="(r, i) in records"
              :key="r.id"
              :hymn="r"
              :no="hymnNo(1, 0, i)"
              :searching="searching"
              :active="sheetOpen && i === sheetIndex"
              @click="open(i)"
            />
          </v-list>
          <template #empty>
            <p class="mobile-home__end">全{{ totalRecords }}件を表示しました</p>
          </template>
        </v-infinite-scroll>
      </v-card>

      <p class="mobile-home__verse">
        "Heaven and Earth will pass away, but My words will not pass away." —
        Luke 21:33
      </p>
    </main>

    <!-- ===== 詳細シート ===== -->
    <!-- 高さは画面の 88%(Vuetify のシートの高さ指定。中のカードは flex で伸びる) -->
    <v-bottom-sheet v-model="sheetOpen" height="88dvh" class="mobile-sheet">
      <v-card color="surface" rounded="t-xl" class="mobile-sheet__card">
        <!-- 取っ手: 下へスワイプで閉じる -->
        <div
          class="mobile-sheet__head"
          @touchstart.passive="onHandleTouchStart"
          @touchend.passive="onHandleTouchEnd"
        >
          <span class="mobile-sheet__handle" aria-hidden="true" />
          <span class="mobile-sheet__pos" aria-live="polite"
            >{{ sheetIndex + 1 }} / {{ totalRecords }}</span
          >
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            aria-label="閉じる"
            class="mobile-sheet__close"
            @click="sheetOpen = false"
          />
        </div>
        <!-- 左右にスワイプで前後の曲へ(v-window。見た曲だけ作る) -->
        <v-window
          v-model="sheetIndex"
          class="mobile-sheet__window"
          :aria-label="current ? `${current.nameJp}の詳細` : undefined"
        >
          <v-window-item v-for="(r, i) in records" :key="r.id" :value="i">
            <HymnDetail
              compact
              color="surface"
              :hymn="r"
              :terms="terms"
              :download="download"
            />
          </v-window-item>
        </v-window>
      </v-card>
    </v-bottom-sheet>
  </div>
</template>

<style scoped>
.mobile-home {
  min-height: 100svh;
  background: #f4f0e7;
  color: #2b1d14;
  font-family: "Noto Sans JP", sans-serif;
}
.mobile-home__bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 12px 0 6px;
  border-bottom: 1px solid #e8e0cf;
  background: #fdfaf2;
}
.mobile-home__brand {
  height: auto !important;
  padding: 6px 8px !important;
  color: #800020;
  letter-spacing: normal;
}
.mobile-home__brand :deep(.v-btn__content) {
  gap: 8px;
}
.mobile-home__logo {
  font-family: "Niconne", cursive;
  font-size: 24px;
  line-height: 1;
  text-transform: none;
}
.mobile-home__main {
  padding: 16px 12px 32px;
}
.mobile-home__icon {
  color: #6b5d4a;
}
.mobile-home__caption {
  margin: 14px 4px 8px;
  font-size: 0.8125rem;
  color: #6b5d4a;
}
.mobile-home__notice {
  margin: 0 4px 8px;
  font-size: 0.75rem;
  color: #8a6400;
}
.mobile-home__card {
  border: 1px solid #e8e0cf;
  /* 一覧の行の左右の余白(PC版より狭く) */
  --hymn-row-inset: 16px;
}
.mobile-home__skeleton {
  border-bottom: 1px solid #efe8da;
}
.mobile-home__empty {
  color: #6b5d4a;
}
.mobile-home__infinite {
  overflow: visible;
}
.mobile-home__end {
  padding: 16px 0;
  font-size: 0.75rem;
  color: #8a7a64;
}
.mobile-home__verse {
  margin-top: 20px;
  padding: 0 8px;
  font-family: "Noto Serif JP", serif;
  font-size: 0.8125rem;
  line-height: 1.7;
  text-align: center;
  color: #8a7a64;
}

/* ===== 詳細シート ===== */
.mobile-sheet__card {
  display: flex;
  flex-direction: column;
}
.mobile-sheet__head {
  position: relative;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  height: 44px;
  touch-action: none;
}
.mobile-sheet__handle {
  position: absolute;
  top: 8px;
  left: 50%;
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: #d9cfbc;
  translate: -50% 0;
}
.mobile-sheet__pos {
  margin-top: 8px;
  font-size: 0.75rem;
  color: #6b5d4a;
}
.mobile-sheet__close {
  position: absolute;
  top: 4px;
  right: 4px;
  color: #6b5d4a;
}
.mobile-sheet__window {
  flex: 1;
  min-height: 0;
}
/* 1曲分を高さいっぱいにして、歌詞だけを中でスクロールさせる */
.mobile-sheet__window :deep(.v-window__container),
.mobile-sheet__window :deep(.v-window-item) {
  height: 100%;
}
.mobile-sheet__window :deep(.hymn-detail) {
  height: 100%;
}
</style>
