<script setup lang="ts">
// 賛美歌ランダム選択(旧 (admin)/hymns/random-five/page.tsx)
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { fetchRandomHymns, hymnKeys, type RandomPath } from "@/api/hymns";
import { usePlaylistCreation } from "@/composables/usePlaylistCreation";
import { useFeedbackStore } from "@/stores/feedback";
import { EMPTY_STRING, extractErrorMessage } from "@/lib/constants";
import PageBackground from "@/components/PageBackground.vue";
import Hint from "@/components/Hint.vue";

/** 出した検索。nonce は検索のたびに変える(同じキーワードでも毎回引き直すため) */
type SearchRequest = { path: RandomPath; keyword: string; nonce: string };

// 読み込み中に表示するスケルトン行の数
const SKELETON_ROWS = 5;

const route = useRoute();
const feedback = useFeedbackStore();
const playlist = usePlaylistCreation();
const { creating, progress } = playlist;

// ヘッダーの検索欄から ?keyword=xxx&t=yyy 付きで遷移してきたら自動検索する。
// t はヘッダーで検索した時刻。同じキーワードでも t が変わるので、この画面にいる状態で
// ヘッダーから検索し直しても(同じキーワードでも)毎回検索が走り、新しい5曲を引き直せる。
const headerRequest = (): SearchRequest | null => {
  const kw = route.query.keyword;
  if (typeof kw !== "string" || !kw) return null;
  const t = typeof route.query.t === "string" ? route.query.t : "";
  return { path: "/common/search", keyword: kw, nonce: `header:${t}` };
};

const keyword = ref(headerRequest()?.keyword ?? EMPTY_STRING);
// 最後に出した検索(null = まだ検索していない)。応答はこの検索の分だけが画面に出るので、
// 連続で検索しても、後から届いた古い応答で新しい結果が上書きされることはない
const request = ref<SearchRequest | null>(headerRequest());

// ヘッダーから検索し直されたら、画面内の検索欄もそのキーワードにして検索を出し直す
watch(
  () => [route.query.keyword, route.query.t],
  () => {
    const next = headerRequest();
    if (next) {
      keyword.value = next.keyword;
      request.value = next;
    }
  },
);

const randomQuery = useQuery(
  computed(() => {
    const req = request.value;
    return {
      queryKey: req
        ? hymnKeys.random(req.path, req.keyword, req.nonce)
        : hymnKeys.random("/hymns/random", "", ""),
      queryFn: () => fetchRandomHymns(req!.path, req!.keyword),
      enabled: req !== null,
      // ランダムなので、一度出した結果を使い回さない
      gcTime: 0,
      staleTime: Infinity,
      retry: false,
    };
  }),
);
const records = computed(() => randomQuery.data.value ?? []);
const loading = computed(() => request.value !== null && randomQuery.isFetching.value);
// 検索して結果が届いたか(未検索の案内と「該当データなし」を出し分けるため。
// 通信エラーのときは「該当データなし」とは言わず、トーストで知らせる)
const searched = computed(() => request.value !== null && randomQuery.isSuccess.value);

watch(randomQuery.error, (err) => {
  if (err) feedback.toast(extractErrorMessage(err, "通信エラー"));
});

const onRandom = () => {
  request.value = { path: "/hymns/random", keyword: keyword.value, nonce: String(Date.now()) };
};

// 検索欄は <form> にして、Enter での送信(日本語変換中の Enter は除く)をブラウザに任せる
const onSubmit = () => {
  if (!loading.value) onRandom();
};

// 画面を開いた直後(入力欄にフォーカスが無い状態)でも Enter で検索できるようにする。
// ボタン・リンク・入力欄にフォーカスがある時やダイアログ表示中は、本来の操作を邪魔しない。
const onWindowKeyDown = (e: KeyboardEvent) => {
  if (e.key !== "Enter" || e.isComposing || e.defaultPrevented) return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  if (loading.value || creating.value) return;
  const t = e.target as HTMLElement | null;
  if (
    t?.closest(
      "input, textarea, select, button, a, summary, [contenteditable], [role=button], [role=menuitem], [role=switch], [role=tab]",
    )
  )
    return;
  if (document.querySelector(".v-overlay--active [role=dialog], .v-overlay--active [role=alertdialog], .v-overlay--active .v-dialog"))
    return;
  e.preventDefault();
  onRandom();
};
onMounted(() => window.addEventListener("keydown", onWindowKeyDown));
onBeforeUnmount(() => window.removeEventListener("keydown", onWindowKeyDown));

const onCreatePlaylist = () =>
  playlist.create(async () => {
    const hymnIds = records.value.map((r) => r.id).filter(Boolean);
    if (hymnIds.length === 0) {
      feedback.toast("先にランダム選択してください");
      return null;
    }
    return { hymnIds };
  });
</script>

<template>
  <div class="random-five">
    <PageBackground src="/assets/mainmenu-bg6.webp" />

    <div class="randomfive-card noto-serif glass-panel">
      <div class="random-five__header">
        <v-icon icon="mdi-view-grid-outline" size="20" class="mr-2" />
        <h1 class="text-title-large">賛美歌ランダム選択</h1>
      </div>

      <div class="pa-6">
        <div class="random-five__toolbar mb-6">
          <form role="search" class="random-five__search" @submit.prevent="onSubmit">
            <v-text-field
              v-model="keyword"
              type="text"
              placeholder="キーワードを入力してください"
              aria-label="キーワード"
              variant="outlined"
              density="compact"
              bg-color="rgba(255,255,255,0.6)"
              color="primary"
              hide-details
            >
              <template #append-inner>
                <Hint label="ランダム選択" v-slot="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-magnify"
                    type="submit"
                    size="x-small"
                    variant="text"
                    aria-label="ランダム選択"
                    :loading="loading"
                  />
                </Hint>
              </template>
            </v-text-field>
          </form>

          <!-- 選択結果があるときだけ表示(未検索時の案内は下の空表示が担当) -->
          <v-btn
            v-if="records.length > 0"
            color="primary"
            variant="flat"
            class="random-five__playlist"
            prepend-icon="mdi-playlist-music"
            :loading="creating"
            @click="onCreatePlaylist"
          >
            プレイリスト作成
            <template #loader>
              <v-progress-circular indeterminate size="16" width="2" class="mr-2" />
              {{ progress }}
            </template>
          </v-btn>
        </div>

        <p class="mb-1 text-center text-body-small random-five__caption">ランダム選択した賛美歌情報一覧</p>
        <div class="header-mint mb-2 px-2 py-2 text-center font-weight-bold">名称</div>

        <div v-if="loading" class="random-five__list" aria-busy="true">
          <div v-for="i in SKELETON_ROWS" :key="i" class="glass-item random-five__item random-five__item--skeleton">
            <v-skeleton-loader type="text" width="40%" class="mx-auto bg-transparent" />
            <v-skeleton-loader type="text" width="25%" class="mx-auto bg-transparent" />
          </div>
        </div>
        <v-empty-state
          v-else-if="records.length === 0"
          class="glass-item random-five__empty"
          :icon="searched ? 'mdi-magnify-close' : 'mdi-shuffle-variant'"
          :title="searched ? '該当データなし' : 'ランダム選択してください'"
          size="40"
        >
          <template #text>
            <template v-if="searched">別のキーワードで試してください。</template>
            <template v-else>
              キーワードを入力して検索ボタンを押すと、<br />賛美歌をランダムに選びます。
            </template>
          </template>
        </v-empty-state>
        <div v-else class="random-five__list">
          <a
            v-for="(item, i) in records"
            :key="item.id ?? item.nameJp"
            :href="item.link"
            target="_blank"
            rel="noopener noreferrer"
            class="glass-item random-five__item"
          >
            <!-- 左右の幅を揃えて(番号 / YouTubeアイコン)、名称を中央に置く -->
            <span class="random-five__no">{{ i + 1 }}</span>
            <span class="random-five__names">
              <span class="random-five__jp">{{ item.nameJp }}</span>
              <span class="random-five__kr">{{ item.nameKr }}</span>
            </span>
            <v-icon icon="mdi-youtube" size="20" class="random-five__yt" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.random-five {
  position: relative;
  min-height: 100%;
}
.randomfive-card {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
}
.random-five__header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #1f2937;
  color: #fff;
}
.random-five__toolbar {
  display: grid;
  /* 検索欄を中央に置く。狭い画面ではプレイリストのボタンが切れないよう、右の列は内容の幅まで広がる */
  grid-template-columns: minmax(0, 1fr) minmax(0, 30rem) minmax(max-content, 1fr);
  align-items: center;
  gap: 16px;
}
.random-five__search {
  grid-column-start: 2;
}
.random-five__playlist {
  grid-column-start: 3;
  justify-self: end;
}
.random-five__caption {
  color: rgba(0, 0, 0, 0.6);
}
.random-five__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.random-five__item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  border-radius: 6px;
  color: inherit;
  text-decoration: none;
}
.random-five__item--skeleton {
  flex-direction: column;
  gap: 4px;
}
.random-five__no {
  width: 32px;
  flex-shrink: 0;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.4);
}
.random-five__names {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
}
.random-five__jp {
  font-size: 1rem;
  font-weight: 600;
  color: #006b3c;
}
.random-five__kr {
  font-size: 0.875rem;
  color: #374151;
}
.random-five__yt {
  width: 32px;
  flex-shrink: 0;
  color: #c4302b;
  opacity: 0.7;
  transition: opacity 0.15s;
}
.random-five__item:hover .random-five__yt {
  opacity: 1;
}
.random-five__empty {
  border-radius: 6px;
}
</style>
