<script setup lang="ts">
// ホーム画面(旧 app/home/page.tsx)。
//   PC   : 開いた讃美歌集(OpenHymnalHome)。左に目次、右に選んだ曲。
//   モバイル: 1枚+次の端がのぞくカルーセル(横スワイプ、終わりに近づくと自動で追加読み込み)。
// カルーセルは CSS の scroll-snap で作る(旧 Embla 相当。Vuetify の v-carousel は1枚ずつの表示で、
// 次のカードの端をのぞかせられないため)。
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import type { AxiosError } from "axios";
import {
  fetchHymnPage,
  hymnKeys,
  type HymnPage,
  type HymnSummary,
} from "@/api/hymns";
import type { ScoreKey } from "@/lib/scoreKeys";
import { fetchScoreKeysOrToast } from "@/lib/scoreKeys";
import { extractTerms } from "@/lib/lyrics";
import {
  searchIndexQueryOptions,
  searchLocal,
  shouldSearchOnServer,
} from "@/lib/localSearch";
import { downloadScoreOrToast } from "@/lib/download";
import { consumeRedirectMessage } from "@/lib/session";
import { EMPTY_STRING } from "@/lib/constants";
import { useFeedbackStore } from "@/stores/feedback";
import { useIsMobile } from "@/composables/useIsMobile";
import ScoreKeyDialog from "@/components/ScoreKeyDialog.vue";
import LyricViewer, { type LyricTarget } from "@/components/LyricViewer.vue";
import PageBackground from "@/components/PageBackground.vue";
import OpenHymnalHome from "@/components/home/OpenHymnalHome.vue";
import HymnCard from "@/components/home/HymnCard.vue";

// デスクトップ(開いた讃美歌集): 左ページの目次に並べる曲数(ページ送りで切替)
const PAGE_SIZE = 11;
// モバイル: カルーセルに一度に追加読み込みする件数
const MOBILE_BATCH_SIZE = 10;
// カルーセルの残りがこの枚数以下になったら次の分を先読みする
const MOBILE_PREFETCH_REMAINING = 4;
// 未取得のスライドのうち、現在位置からこの枚数以内だけスケルトンカードを描く。
// それより遠いスライドは同じ大きさの空の箱にする(画面に入らないので見た目は変わらない)
const MOBILE_SKELETON_WINDOW = 4;

const router = useRouter();
const feedback = useFeedbackStore();
const queryClient = useQueryClient();
const isMobile = useIsMobile();

// 別端末ログインによる強制ログアウト等で localStorage に残したメッセージをトースト表示する
onMounted(() => {
  const msg = consumeRedirectMessage();
  if (msg) feedback.toast(msg);
});

const page = ref(1);
const keyword = ref(EMPTY_STRING); // 入力欄の値(即時反映)
const submittedKeyword = ref(EMPTY_STRING); // 検索確定値(クエリキー用)

// ===== 検索の振り分け =====
// ハングルを含む / 先頭が * ★ # / & を含む入力はサーバー検索(従来どおり)。
// それ以外(日本語・英語など)は、画面側で曲名・日本語/英語の歌詞に照らして並べる。
const localCandidate = computed(
  () =>
    submittedKeyword.value.trim() !== "" &&
    !shouldSearchOnServer(submittedKeyword.value),
);
const indexQuery = useQuery(
  computed(() => ({
    ...searchIndexQueryOptions,
    enabled: localCandidate.value,
  })),
);
// 索引の取得に失敗したときは、画面検索をあきらめてサーバー検索に戻す
const isLocal = computed(
  () => localCandidate.value && !indexQuery.isError.value,
);
const local = computed(() =>
  isLocal.value && indexQuery.data.value
    ? searchLocal(indexQuery.data.value, submittedKeyword.value)
    : null,
);
const localAll = computed<HymnSummary[]>(() => local.value?.records ?? []);
// 一致が1曲も無かったときの案内(全曲を通常の順序で出している)
const localNotice = computed(() =>
  isLocal.value && local.value && local.value.hitCount === 0
    ? "一致する曲が見つからなかったため、通常の順序で表示しています"
    : null,
);

// モバイル/デスクトップが切り替わったらデスクトップ側は1ページ目に戻す
watch(isMobile, () => {
  page.value = 1;
});

// ===== PC: ページ送り =====
const pageParams = computed(() => ({
  pageNum: page.value,
  pageSize: PAGE_SIZE,
  keyword: submittedKeyword.value,
}));
const desktopQuery = useQuery(
  computed(() => ({
    queryKey: hymnKeys.page(pageParams.value),
    queryFn: () => fetchHymnPage(pageParams.value),
    placeholderData: keepPreviousData,
    enabled: !isMobile.value && !isLocal.value,
  })),
);

// ===== モバイル: カルーセル用の無限読み込み =====
const mobileQuery = useInfiniteQuery(
  computed(() => ({
    queryKey: hymnKeys.infinite(MOBILE_BATCH_SIZE, submittedKeyword.value),
    queryFn: ({ pageParam }: { pageParam: number }): Promise<HymnPage> =>
      fetchHymnPage({
        pageNum: pageParam,
        pageSize: MOBILE_BATCH_SIZE,
        keyword: submittedKeyword.value,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: HymnPage, allPages: HymnPage[]) =>
      allPages.length * MOBILE_BATCH_SIZE < lastPage.totalRecords
        ? allPages.length + 1
        : undefined,
    enabled: isMobile.value && !isLocal.value,
  })),
);

watch(
  () => desktopQuery.error.value ?? mobileQuery.error.value,
  (err) => {
    if (!err) return;
    const msg = (err as AxiosError<string>)?.response?.data ?? "通信エラー";
    feedback.toast(typeof msg === "string" ? msg : "通信エラー");
  },
);

const records = computed<HymnSummary[]>(() =>
  isLocal.value
    ? localAll.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)
    : (desktopQuery.data.value?.records ?? []),
);
const totalRecords = computed(() =>
  isLocal.value
    ? localAll.value.length
    : (desktopQuery.data.value?.totalRecords ?? 0),
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalRecords.value / PAGE_SIZE)),
);
// 画面検索では、索引を取得し終えるまでが「読み込み中」
const desktopBusy = computed(() =>
  isLocal.value ? indexQuery.isPending.value : desktopQuery.isFetching.value,
);

// モバイル: カルーセルの現在位置(画面検索では、この位置から先読み分だけカードを描く)
const currentSlide = ref(0);
const mobileRecords = computed<HymnSummary[]>(() =>
  isLocal.value
    ? localAll.value.slice(0, currentSlide.value + MOBILE_BATCH_SIZE)
    : (mobileQuery.data.value?.pages.flatMap((p) => p.records) ?? []),
);
const mobileTotal = computed(() =>
  isLocal.value
    ? localAll.value.length
    : (mobileQuery.data.value?.pages[0]?.totalRecords ?? 0),
);
const mobileBusy = computed(() =>
  isLocal.value ? indexQuery.isPending.value : mobileQuery.isFetching.value,
);

// スライドの枚数は最初から「全件数」で固定し、未取得の分はスケルトンで埋めておく
// (追加読み込みでスライドの中身だけが入れ替わり、スクロール位置がずれない)
type SlideKind = "card" | "skeleton" | "placeholder";
const slideKind = (i: number): SlideKind =>
  mobileRecords.value[i]
    ? "card"
    : Math.abs(i - currentSlide.value) <= MOBILE_SKELETON_WINDOW
      ? "skeleton"
      : "placeholder";

// ===== モバイル: カルーセルの現在位置と先読み =====
const track = ref<HTMLElement | null>(null);
let scrollFrame = 0;
const onTrackScroll = () => {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    const el = track.value;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    // 1枚分の送り幅(カード幅 + すき間)
    const step =
      first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0");
    currentSlide.value = Math.max(0, Math.round(el.scrollLeft / step));
  });
};

watch(
  () =>
    [
      currentSlide.value,
      mobileRecords.value.length,
      mobileQuery.hasNextPage.value,
    ] as const,
  () => {
    if (
      isMobile.value &&
      !isLocal.value &&
      mobileQuery.hasNextPage.value &&
      !mobileQuery.isFetchingNextPage.value &&
      currentSlide.value >=
        mobileRecords.value.length - MOBILE_PREFETCH_REMAINING
    ) {
      void mobileQuery.fetchNextPage();
    }
  },
);

// 検索やロゴクリックでデータが入れ替わる時は、カルーセルを先頭へ戻す
const resetCarousel = () => {
  currentSlide.value = 0;
  void nextTick(() => track.value?.scrollTo({ left: 0 }));
};

const currentBg = computed(() =>
  isMobile.value ? "/assets/home-bg2.webp" : "/assets/home-bg3.webp",
);

// 検索欄は <form> にして、Enter での送信(日本語変換中の Enter は除く)をブラウザに任せる
const onSearch = () => {
  page.value = 1;
  submittedKeyword.value = keyword.value;
  resetCarousel();
};

// モバイル: 調が複数ある曲は中央ダイアログで選ばせ、1件ならそのままダウンロード
const keyDialog = ref<{ item: HymnSummary; keys: ScoreKey[] } | null>(null);
const keyDialogOpen = computed({
  get: () => keyDialog.value !== null,
  set: (o) => {
    if (!o) keyDialog.value = null;
  },
});
const onMobileScore = async (id: string) => {
  const keys = await fetchScoreKeysOrToast(queryClient, id);
  if (keys === null) return;
  const item = mobileRecords.value.find((r) => r?.id === id);
  if (keys.length > 1 && item) keyDialog.value = { item, keys };
  else await downloadScoreOrToast(id);
};

// ===== 歌詞の表示(照合) =====
// モバイルは画面の下から出るシートで表示する(PC版は開いた讃美歌集の右ページに常に表示する)
const lyricTarget = ref<LyricTarget | null>(null);
const openLyric = (item: HymnSummary) => {
  lyricTarget.value = {
    id: item.id,
    nameJp: item.nameJp,
    nameKr: item.nameKr,
    lineNumber: item.lineNumber,
  };
};
// ハイライトする語。確定した検索キーワードから作る(入力中の文字では変わらない)
const lyricTerms = computed(() => extractTerms(submittedKeyword.value));

/** ダイアログ・シートをカードと同じガラス風・同じ色にする(app.css の .bubble-glass) */
const bubbleClass = (line: string | undefined) =>
  `bubble-glass bubble-${line && ["BURGUNDY", "NAPLES", "CADMIUM"].includes(line) ? line : "DEFAULT"}`;

const goLogin = () => router.push("/login");
const reload = () => {
  page.value = 1;
  keyword.value = EMPTY_STRING;
  submittedKeyword.value = EMPTY_STRING;
  resetCarousel();
};
</script>

<template>
  <!-- ===== PC版: 開いた讃美歌集 ===== -->
  <OpenHymnalHome
    v-if="!isMobile"
    v-model:keyword="keyword"
    :records="records"
    :total-records="totalRecords"
    :page="page"
    :total-pages="totalPages"
    :page-size="PAGE_SIZE"
    :is-fetching="desktopBusy"
    :submitted-keyword="submittedKeyword"
    :terms="lyricTerms"
    :hit-count="isLocal && local ? local.hitCount : undefined"
    :notice="localNotice"
    :download="downloadScoreOrToast"
    @search="onSearch"
    @reload="reload"
    @login="goLogin"
    @update:page="(p) => (page = p)"
  />

  <!-- ===== モバイル版 ===== -->
  <div v-else class="home">
    <PageBackground :src="currentBg" />

    <header class="home-nav">
      <button type="button" class="home-nav__brand" @click="reload">
        <img
          src="/assets/jerusalem-cross2.svg"
          alt="NASB1995"
          width="66"
          height="66"
        />
        <span class="effect-shine home-nav__title">NASB1995</span>
      </button>
    </header>

    <main class="home__main">
      <form role="search" class="home__search" @submit.prevent="onSearch">
        <!-- 読み込み中は、検索欄のまわりに細いリングを脈打たせる -->
        <span
          v-if="desktopBusy || mobileBusy"
          aria-hidden="true"
          class="home__search-ring"
        />
        <input
          v-model="keyword"
          type="text"
          placeholder="曲名・歌詞のキーワードで検索してください"
          aria-label="キーワード"
          class="home__search-input"
        />
        <v-btn
          type="submit"
          icon="mdi-magnify"
          size="small"
          variant="text"
          aria-label="検索"
          class="home__search-btn"
        />
      </form>

      <p v-if="localNotice" role="status" class="home__notice">
        {{ localNotice }}
      </p>

      <!-- 1枚+次の端がのぞくカルーセル -->
      <div
        v-if="mobileBusy && mobileRecords.length === 0"
        class="home__track home__track--loading"
      >
        <div class="home__slide"><HymnCard /></div>
        <div class="home__slide"><HymnCard /></div>
      </div>
      <v-empty-state
        v-else-if="mobileRecords.length === 0"
        icon="mdi-magnify-close"
        title="該当データなし"
        text="別の韓国語単語で検索してください。"
        class="home__empty"
      />
      <div
        v-else
        ref="track"
        class="home__track"
        role="region"
        aria-roledescription="carousel"
        aria-label="賛美歌カード"
        @scroll.passive="onTrackScroll"
      >
        <!-- key は位置(i)で固定: 読み込み完了でスライド自体を差し替えず、中身だけ入れ替える -->
        <div
          v-for="i in mobileTotal"
          :key="i"
          class="home__slide"
          role="group"
          aria-roledescription="slide"
        >
          <HymnCard
            v-if="slideKind(i - 1) !== 'placeholder'"
            :item="mobileRecords[i - 1]"
            @score="onMobileScore"
            @lyric="openLyric"
          />
          <!-- .glass-card.is-slide と同じ高さを確保し、カルーセルの高さが変わらないようにする -->
          <div v-else class="home__placeholder" aria-hidden="true" />
        </div>
      </div>
      <p
        v-if="mobileTotal > 0"
        class="page-info home__page-info"
        aria-live="polite"
      >
        {{ Math.min(currentSlide + 1, mobileTotal) }} / {{ mobileTotal }}件
      </p>

      <LyricViewer
        :target="lyricTarget"
        :terms="lyricTerms"
        variant="sheet"
        :content-class="bubbleClass(lyricTarget?.lineNumber)"
        @close="lyricTarget = null"
      />

      <ScoreKeyDialog
        v-model="keyDialogOpen"
        :title="
          keyDialog
            ? `${keyDialog.item.nameJp} / ${keyDialog.item.nameKr}`
            : undefined
        "
        :keys="keyDialog?.keys ?? []"
        :content-class="bubbleClass(keyDialog?.item.lineNumber)"
        item-class="bubble-item"
        @select="
          (chord) => keyDialog && downloadScoreOrToast(keyDialog.item.id, chord)
        "
      />

      <p class="hint-verse home__verse">
        "Heaven and Earth will pass away, but My words will not pass away." ---
        Luke 21:33
      </p>
    </main>
  </div>
</template>

<style scoped>
.home {
  position: relative;
  z-index: 0;
  min-height: 100vh;
}
.home-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 24px;
  background: #fffef7;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.home-nav__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: none;
}
.home-nav__title {
  font-size: 2.2rem;
}
.home__main {
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 16px 64px;
}
.home__search {
  position: relative;
  max-width: 520px;
  margin: 0 auto 28px;
}
.home__search-ring {
  pointer-events: none;
  position: absolute;
  inset: -2px;
  border-radius: 9999px;
  box-shadow: 0 0 0 2px rgba(128, 0, 32, 0.6);
  animation: home-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes home-pulse {
  50% {
    opacity: 0.5;
  }
}
.home__search-input {
  width: 100%;
  padding: 12px 44px 12px 20px;
  border: 0;
  border-radius: 9999px;
  outline: none;
  background: rgba(255, 255, 255, 0.67);
  font-size: 1rem;
}
.home__search-input::placeholder {
  color: rgba(0, 0, 0, 0.5);
}
.home__search-btn {
  position: absolute;
  top: 50%;
  right: 6px;
  translate: 0 -50%;
}
.home__notice,
.home__page-info,
.home__verse {
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.home__notice {
  margin-bottom: 12px;
  text-align: center;
  font-size: 0.75rem;
}
/* カルーセル: 横スクロール + スナップ。上下に余白を足し(負のマージンで相殺)、浮き上がり・光が切れないようにする */
.home__track {
  display: flex;
  column-gap: 12px;
  margin: -28px 0;
  padding: 28px 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}
.home__track::-webkit-scrollbar {
  display: none;
}
.home__track--loading {
  overflow: hidden;
}
.home__slide {
  flex: 0 0 80%;
  min-width: 0;
  scroll-snap-align: start;
}
.home__placeholder {
  height: 100%;
  min-height: 44vh;
}
.home__empty {
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}
.home__page-info {
  margin-top: 12px;
  text-align: center;
  font-size: 0.75rem;
}
.home__verse {
  margin-top: 20px;
  font-size: 13px;
  font-weight: 700;
  color: #fffff0;
}
</style>
