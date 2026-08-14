<script setup lang="ts">
// src/views/HomeView.vue
// 旧 views/HomeView.tsx を移植
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import type { AxiosError } from "axios";
import { LogIn, Search } from "@lucide/vue";
import api from "@/api/axios";
import { useFeedbackStore } from "@/stores/feedback";
import { EMPTY_STRING, extractErrorMessage } from "@/constants";
import brandLogo from "@/assets/jerusalem-cross2.svg";
import bgImage from "@/assets/home-bg3.webp";
import bgImageMobile from "@/assets/home-bg2.webp";

type HymnRecord = {
  id: number;
  nameJp: string;
  nameKr: string;
  link: string;
  lineNumber: "BURGUNDY" | "NAPLES" | "CADMIUM" | string;
};

type PaginationResponse = {
  records: HymnRecord[];
  totalRecords: number;
};

const SWIPE_THRESHOLD = 50;

const lineClass = (line: string) =>
  ({
    BURGUNDY: "is-burgundy",
    NAPLES: "is-naples",
    CADMIUM: "is-cadmium",
  })[line] ?? EMPTY_STRING;

const router = useRouter();
const feedback = useFeedbackStore();

// --- レスポンシブ判定(旧 useMediaQuery("(max-width:700px)")相当) ---
const mql = window.matchMedia("(max-width: 700px)");
const isMobile = ref(mql.matches);
const onMqlChange = (e: MediaQueryListEvent) => {
  isMobile.value = e.matches;
};
onMounted(() => mql.addEventListener("change", onMqlChange));
onUnmounted(() => mql.removeEventListener("change", onMqlChange));

// 別端末ログインによる強制ログアウト(session.ts の401ハンドラ)等で
// localStorageにセットされたメッセージをトースト表示する。
// 旧 mainmenu.js / MainMenu.vue の redirectMessage 表示パターンと同じ。
onMounted(() => {
  const msg = localStorage.getItem("redirectMessage");
  if (msg) {
    feedback.toast(msg);
    localStorage.removeItem("redirectMessage");
  }
});

const PAGE_SIZE = computed(() => (isMobile.value ? 2 : 5));

const page = ref(1);
const keyword = ref(EMPTY_STRING); // 入力欄の値(即時反映)
const submittedKeyword = ref(EMPTY_STRING); // 検索確定値(クエリキー用)

// モバイル/デスクトップ切替でページサイズが変わるため1ページ目から取り直す
// (初回マウント時は実行しない)
let isMobileMounted = false;
watch(isMobile, () => {
  if (!isMobileMounted) {
    isMobileMounted = true;
    return;
  }
  page.value = 1;
});

const { data, isFetching, error } = useQuery<PaginationResponse>({
  queryKey: computed(() => [
    "hymns-pagination",
    page.value,
    PAGE_SIZE.value,
    submittedKeyword.value,
  ]),
  queryFn: async () => {
    const { data } = await api.get("/hymns", {
      params: {
        pageNum: page.value,
        pageSize: PAGE_SIZE.value,
        keyword: submittedKeyword.value.normalize("NFC"),
      },
    });
    return data;
  },
  placeholderData: keepPreviousData, // 旧: loading中もDOMを維持しopacity制御、と同じ狙い
});

watch(error, (e) => {
  if (e) {
    const msg = (e as AxiosError<string>)?.response?.data ?? "通信エラー";
    feedback.toast(typeof msg === "string" ? msg : "通信エラー");
  }
});

const records = computed(() => data.value?.records ?? []);
const totalRecords = computed(() => data.value?.totalRecords ?? 0);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalRecords.value / PAGE_SIZE.value)),
);
const currentBg = computed(() => (isMobile.value ? bgImageMobile : bgImage));

const onSearch = () => {
  page.value = 1;
  submittedKeyword.value = keyword.value;
};

const onSearchKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Enter") onSearch();
};

const downloadScore = async (id: number) => {
  try {
    const res = await api.get(`/hymns/${id}/score`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e: unknown) {
    feedback.toast(extractErrorMessage(e, "楽譜の取得に失敗しました"));
  }
};

const goLogin = () => router.push("/login");
const reload = () => {
  page.value = 1;
  keyword.value = EMPTY_STRING;
  submittedKeyword.value = EMPTY_STRING;
};

// ===== モバイル: 左右スワイプでページ送り =====
const touchStart = { x: 0, y: 0 };

const onTouchStart = (e: TouchEvent) => {
  if (!isMobile.value) return;
  touchStart.x = e.changedTouches[0].clientX;
  touchStart.y = e.changedTouches[0].clientY;
};

const goNextPage = () => {
  if (page.value >= totalPages.value) {
    feedback.toast("これが最後です");
    return;
  }
  page.value += 1;
};

const goPrevPage = () => {
  if (page.value <= 1) {
    feedback.toast("これが最初です");
    return;
  }
  page.value -= 1;
};

const onTouchEnd = (e: TouchEvent) => {
  if (!isMobile.value) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;

  if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;

  if (dx < 0) goNextPage();
  else goPrevPage();
};

// 旧 MUI <Pagination siblingCount={2}> 相当のページ番号リスト生成
// (boundaryCount=1がMUIのデフォルト)
const pageItems = computed<(number | "ellipsis")[]>(() => {
  const total = totalPages.value;
  const cur = page.value;
  const siblingCount = 2;
  const boundaryCount = 1;

  const range = (start: number, end: number) =>
    Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const startPages = range(1, Math.min(boundaryCount, total));
  const endPages = range(
    Math.max(total - boundaryCount + 1, boundaryCount + 1),
    total,
  );

  const siblingsStart = Math.max(
    Math.min(cur - siblingCount, total - boundaryCount - siblingCount * 2 - 1),
    boundaryCount + 2,
  );
  const siblingsEnd = Math.min(
    Math.max(cur + siblingCount, boundaryCount + siblingCount * 2 + 2),
    endPages.length > 0 ? endPages[0] - 2 : total - 1,
  );

  const items: (number | "ellipsis")[] = [
    ...startPages,
    ...(siblingsStart > boundaryCount + 2
      ? ["ellipsis" as const]
      : boundaryCount + 1 < total - boundaryCount
        ? [boundaryCount + 1]
        : []),
    ...range(siblingsStart, siblingsEnd),
    ...(siblingsEnd < total - boundaryCount - 1
      ? ["ellipsis" as const]
      : total - boundaryCount > boundaryCount
        ? [total - boundaryCount]
        : []),
    ...endPages,
  ];

  // 重複除去(小さいページ数の時に範囲が重なるため)
  return items.filter(
    (item, idx) => item === "ellipsis" || items.indexOf(item) === idx,
  );
});
</script>

<template>
  <div class="home relative z-0">
    <div class="fixed inset-0 -z-10">
      <img :src="currentBg" alt="" class="h-full w-full object-cover" />
    </div>

    <header class="home-nav">
      <div class="home-brand" @click="reload">
        <img :src="brandLogo" alt="NASB1995" width="66" height="66" />
        <span class="effect-shine">NASB1995</span>
      </div>
      <button class="login-btn-desktop" @click="goLogin">
        <LogIn class="h-4 w-4" /> ログイン
      </button>
    </header>

    <main class="home-main" @touchstart="onTouchStart" @touchend="onTouchEnd">
      <div class="search-row" :class="{ 'search-loading': isFetching }">
        <input
          v-model="keyword"
          type="text"
          placeholder="韓国語単語で検索してください"
          class="search-input"
          @keydown="onSearchKeyDown"
        />
        <button type="button" class="search-btn" @click="onSearch">
          <Search class="h-4 w-4" />
        </button>
      </div>

      <div class="card-row" :class="{ 'card-row--loading': isFetching }">
        <div v-if="!isFetching && records.length === 0" class="loading">
          該当データなし
        </div>
        <article
          v-for="item in records"
          :key="item.id"
          class="glass-card"
          :class="lineClass(item.lineNumber)"
        >
          <a
            class="song-name"
            :href="item.link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ item.nameJp }} / {{ item.nameKr }}
          </a>
          <button
            class="score-btn"
            title="楽譜ダウンロード"
            @click="downloadScore(item.id)"
          >
            𝄞
          </button>
        </article>
      </div>

      <div v-if="!isMobile" class="pager-row pager-row-desktop">
        <span class="page-info">
          {{ totalPages }}ページ中の{{ page }}ページ、{{ totalRecords }}件
        </span>
        <div class="pager-glass">
          <button class="pager-item" :disabled="page <= 1" @click="page -= 1">
            ‹
          </button>
          <template v-for="(item, idx) in pageItems" :key="idx">
            <span v-if="item === 'ellipsis'" class="pager-ellipsis">…</span>
            <button
              v-else
              class="pager-item"
              :class="{ 'is-selected': item === page }"
              @click="page = item"
            >
              {{ item }}
            </button>
          </template>
          <button
            class="pager-item"
            :disabled="page >= totalPages"
            @click="page += 1"
          >
            ›
          </button>
        </div>
      </div>

      <p v-if="isMobile" class="hint-verse">
        "Heaven and Earth will pass away, but My words will not pass away." ---
        Luke 21:33
      </p>
    </main>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}

/* 基本スタイル(Niconneフォント等)はmain.cssのグローバル定義を継承し、
   HomeView内はサイズだけ上書きする(旧 HomeView.css の挙動) */
.effect-shine {
  font-size: 2.2rem;
}

.home-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 24px;
  background-color: #fffef7;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.home-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.login-btn-desktop {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background-color: #ed6c02;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.home-main {
  max-width: 1000px;
  margin: 0 auto;
  padding: 32px 16px 64px;
}

.search-row {
  max-width: 520px;
  margin: 0 auto 28px;
  position: relative;
}

.search-input {
  width: 100%;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.67);
  border: none;
  padding: 12px 44px 12px 20px;
  font-size: 1rem;
  outline: none;
}

.search-btn {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
}

.card-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  transition: opacity 0.15s ease;
}

@media (max-width: 1100px) {
  .card-row {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 700px) {
  .home-nav {
    justify-content: flex-start;
    padding: 8px 16px;
  }

  .login-btn-desktop {
    display: none;
  }

  .home-main {
    padding: 20px 16px 48px;
  }

  .card-row {
    grid-template-columns: 1fr;
  }

  .pager-row-desktop {
    display: none;
  }
}

.card-row--loading {
  opacity: 0.45;
  pointer-events: none;
}

.loading {
  grid-column: 1 / -1;
  text-align: center;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  padding: 40px 0;
}

.glass-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 330px;
  padding: 20px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.33);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  overflow: hidden;
  transition: box-shadow 0.3s ease;
}

.glass-card.is-burgundy {
  background: rgba(128, 0, 32, 0.42);
}

.glass-card.is-naples {
  background: rgba(246, 201, 28, 0.42);
}

.glass-card.is-cadmium {
  background: rgba(13, 92, 51, 0.42);
}

@media (max-width: 700px) {
  .glass-card {
    min-height: 28.5vh;
  }
}

@property --angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

.glass-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 2px;
  background: conic-gradient(
    from var(--angle),
    transparent 0deg,
    transparent 270deg,
    #800020 320deg,
    #c0405f 350deg,
    #800020 360deg
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.glass-card.is-naples::before {
  background: conic-gradient(
    from var(--angle),
    transparent 0deg,
    transparent 270deg,
    #b8860b 320deg,
    #f6c91c 350deg,
    #b8860b 360deg
  );
}

.glass-card.is-cadmium::before {
  background: conic-gradient(
    from var(--angle),
    transparent 0deg,
    transparent 270deg,
    #0d5c33 320deg,
    #2ecc71 350deg,
    #0d5c33 360deg
  );
}

.glass-card:hover::before {
  opacity: 1;
  animation: rotate-border 2250ms linear infinite;
}

@keyframes rotate-border {
  to {
    --angle: 360deg;
  }
}

.glass-card:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}

.song-name {
  font-family: "Noto Serif JP", serif;
  font-weight: 600;
  font-size: 1.05rem;
  line-height: 1.5;
  color: #fff;
  text-decoration: none;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.66);
  cursor: pointer;
  position: relative;
  z-index: 1;
}

.song-name:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.score-btn {
  align-self: flex-end;
  margin-top: 12px;
  font-size: 1.8rem;
  line-height: 1;
  color: #fff;
  background: none;
  border: none;
  cursor: pointer;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.66);
  position: relative;
  z-index: 1;
  transition:
    transform 0.15s ease,
    opacity 0.15s ease;
}

.score-btn:hover {
  transform: scale(1.2);
  opacity: 0.85;
}

.pager-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.page-info {
  font-size: 12px;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.pager-glass {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 14px;
  padding: 2px 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
}

.pager-item {
  min-width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 999px;
  color: #353542;
  font-weight: 600;
  cursor: pointer;
}

.pager-item:disabled {
  opacity: 0.4;
  cursor: default;
}

.pager-item.is-selected {
  background-color: #800020;
  color: #fff;
}

.pager-ellipsis {
  min-width: 32px;
  text-align: center;
  color: #353542;
}

.hint-verse {
  margin-top: 20px;
  font-size: 13px;
  font-weight: 700;
  color: #fffff0;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.search-row::before {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: 999px;
  padding: 3px;
  background: conic-gradient(
    from var(--angle),
    transparent 0deg,
    transparent 270deg,
    #800020 320deg,
    #c0405f 350deg,
    #800020 360deg
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  opacity: 0;
  pointer-events: none;
  z-index: 0;
}

.search-row.search-loading::before {
  opacity: 1;
  animation: rotate-border 3300ms linear infinite;
}
</style>
