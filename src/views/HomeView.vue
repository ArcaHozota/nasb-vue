<script setup lang="ts">
// ホーム画面(旧 app/home/page.tsx)。PC版・モバイル版とも、クリーム地・白いカード・臙脂の同じ見た目。
//   PC     : 左右2つのカード(DesktopHome)。左に曲の一覧(ページ送り)、右に選んだ曲の詳細。
//   モバイル: 曲の一覧(MobileHome)。下までフリックすると読み足し、曲を押すと詳細が下からシートで出る。
// ここはデータ取得・検索・ページ送りの状態だけを持つ。
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/vue-query";
import type { AxiosError } from "axios";
import {
  fetchHymnPage,
  hymnKeys,
  type HymnPage,
  type HymnSummary,
} from "@/api/hymns";
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
import DesktopHome from "@/components/home/DesktopHome.vue";
import MobileHome from "@/components/home/MobileHome.vue";

// デスクトップ: 左の一覧に並べる曲数(ページ送りで切替)
const PAGE_SIZE = 10;
// モバイル: 一覧に一度に読み足す件数
const MOBILE_BATCH_SIZE = 10;

const router = useRouter();
const feedback = useFeedbackStore();
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
const hitCount = computed(() =>
  isLocal.value && local.value ? local.value.hitCount : undefined,
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

// ===== モバイル: 一覧の読み足し =====
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

// 画面検索のときにモバイルの一覧に出している件数(下までフリックするたびに増やす)
const localShown = ref(MOBILE_BATCH_SIZE);
const mobileRecords = computed<HymnSummary[]>(() =>
  isLocal.value
    ? localAll.value.slice(0, localShown.value)
    : (mobileQuery.data.value?.pages.flatMap((p) => p.records) ?? []),
);
const mobileTotal = computed(() =>
  isLocal.value
    ? localAll.value.length
    : (mobileQuery.data.value?.pages[0]?.totalRecords ?? 0),
);
const mobileHasMore = computed(() =>
  isLocal.value
    ? localShown.value < localAll.value.length
    : !!mobileQuery.hasNextPage.value,
);
const mobileBusy = computed(() =>
  isLocal.value ? indexQuery.isPending.value : mobileQuery.isFetching.value,
);
/** 次の曲を読み足す。読み足したあとも残りがあれば true */
const loadMoreMobile = async (): Promise<boolean> => {
  if (isLocal.value) {
    localShown.value += MOBILE_BATCH_SIZE;
    return localShown.value < localAll.value.length;
  }
  if (!mobileQuery.hasNextPage.value) return false;
  if (mobileQuery.isFetchingNextPage.value) return true;
  const result = await mobileQuery.fetchNextPage();
  if (result.isError) throw result.error;
  return !!result.hasNextPage;
};

// 検索欄は <form> にして、Enter での送信(日本語変換中の Enter は除く)をブラウザに任せる
const onSearch = () => {
  page.value = 1;
  localShown.value = MOBILE_BATCH_SIZE;
  submittedKeyword.value = keyword.value;
};

// ハイライトする語。確定した検索キーワードから作る(入力中の文字では変わらない)
const lyricTerms = computed(() => extractTerms(submittedKeyword.value));

const goLogin = () => router.push("/login");
const reload = () => {
  page.value = 1;
  localShown.value = MOBILE_BATCH_SIZE;
  keyword.value = EMPTY_STRING;
  submittedKeyword.value = EMPTY_STRING;
  window.scrollTo({ top: 0 });
};
</script>

<template>
  <!-- ===== PC版: 左に一覧、右に詳細 ===== -->
  <DesktopHome
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
    :hit-count="hitCount"
    :notice="localNotice"
    :download="downloadScoreOrToast"
    @search="onSearch"
    @reload="reload"
    @login="goLogin"
    @update:page="(p) => (page = p)"
  />

  <!-- ===== モバイル版: 一覧＋下から出る詳細 ===== -->
  <MobileHome
    v-else
    v-model:keyword="keyword"
    :records="mobileRecords"
    :total-records="mobileTotal"
    :is-fetching="mobileBusy"
    :has-more="mobileHasMore"
    :load-more="loadMoreMobile"
    :submitted-keyword="submittedKeyword"
    :terms="lyricTerms"
    :hit-count="hitCount"
    :notice="localNotice"
    :download="downloadScoreOrToast"
    @search="onSearch"
    @reload="reload"
  />
</template>
