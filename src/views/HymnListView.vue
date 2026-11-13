<script setup lang="ts">
// 賛美歌一覧(旧 (admin)/hymns/page.tsx)
import { computed, ref, watch } from "vue";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/vue-query";
import api from "@/api/axios";
import { fetchHymnPage, hymnKeys, invalidateHymns, type HymnSummary } from "@/api/hymns";
import { usePlaylistCreation } from "@/composables/usePlaylistCreation";
import { useFeedbackStore } from "@/stores/feedback";
import { EMPTY_STRING, extractErrorMessage } from "@/lib/constants";
import { fetchScoreKeysOrToast, invalidateScoreKeys } from "@/lib/scoreKeys";
import { downloadScoreOrToast } from "@/lib/download";
import { hymnNameSizeClass } from "@/lib/text";
import PageBackground from "@/components/PageBackground.vue";
import HymnScoreModal from "@/components/HymnScoreModal.vue";
import HymnFormModal from "@/components/HymnFormModal.vue";
import Hint from "@/components/Hint.vue";
import ClampText from "@/components/ClampText.vue";
import ScoreKeyPopover from "@/components/ScoreKeyPopover.vue";

// 検索時に「番号」列へ出す一致度(lineNumber の値 → 表示)
const MATCH_LEVEL: Record<string, { label: string; chip: string }> = {
  CADMIUM: { label: "よく一致", chip: "match-chip--cadmium" },
  BURGUNDY: { label: "一致", chip: "match-chip--burgundy" },
  NAPLES: { label: "やや一致", chip: "match-chip--naples" },
};
const MATCH_RELATED = { label: "関連", chip: "match-chip--related" };
const PAGE_SIZE_OPTIONS = [5, 10, 15].map((n) => ({ value: n, title: `${n}件/ページ` }));

const feedback = useFeedbackStore();
const queryClient = useQueryClient();
const playlist = usePlaylistCreation();

// 追加・編集はモーダルなので、ページ位置や検索条件を URL で受け渡す必要はない
const page = ref(1);
const pageSize = ref(10);
const keyword = ref(EMPTY_STRING);
const submittedKeyword = ref(EMPTY_STRING);

const pageParams = computed(() => ({
  pageNum: page.value,
  pageSize: pageSize.value,
  keyword: submittedKeyword.value,
}));
const { data, isFetching } = useQuery(
  computed(() => ({
    queryKey: hymnKeys.page(pageParams.value),
    queryFn: () => fetchHymnPage(pageParams.value),
    placeholderData: keepPreviousData,
  })),
);

const records = computed(() => data.value?.records ?? []);
const totalRecords = computed(() => data.value?.totalRecords ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(totalRecords.value / pageSize.value)));

// 最後のページの最後の1件を削除した等で、今のページが総ページ数を超えたら最終ページへ戻す
// (取得中は前ページのデータなので判定しない)
watch([isFetching, totalPages], () => {
  if (!isFetching.value && data.value && page.value > totalPages.value) {
    page.value = totalPages.value;
  }
});

// 検索中は「番号」列を一致度に切り替える(検索確定後のキーワードで判定)
const isSearching = computed(() => submittedKeyword.value.trim() !== EMPTY_STRING);
const matchLevel = (row: HymnSummary) => MATCH_LEVEL[row.lineNumber] ?? MATCH_RELATED;
const rowNumber = (i: number) => String((page.value - 1) * pageSize.value + i + 1).padStart(2, "0");

// 行クリック: 曲のYouTubeリンクを新しいタブで開く
const openYoutube = (row: HymnSummary) => {
  if (row.link) window.open(row.link, "_blank", "noopener,noreferrer");
};

// 検索欄は <form> にして、Enter での送信(日本語変換中の Enter は除く)をブラウザに任せる
const onSearch = () => {
  page.value = 1;
  submittedKeyword.value = keyword.value;
};

const onPageSizeChange = (value: number) => {
  pageSize.value = value;
  page.value = 1;
};

// ===== 追加・編集(モーダル。一覧の page / pageSize / keyword はそのまま保たれる) =====
// HYMNS.ID は Snowflake の19桁でJS numberでは精度が壊れるため、IDは string で持つ。
const formModal = ref<{ mode: "add" } | { mode: "edit"; id: string } | null>(null);

const onFormSaved = (result: { mode: "add" | "edit"; pageNum?: number }) => {
  formModal.value = null;
  if (result.mode === "add") {
    // 新しい曲は検索条件なしの一覧の最後のページに載るので、検索を解除してそのページへ移動する
    keyword.value = EMPTY_STRING;
    submittedKeyword.value = EMPTY_STRING;
    if (result.pageNum) page.value = result.pageNum;
  }
  // キャッシュは HymnFormModal が保存後に捨てている(invalidateHymns)
};

// ===== 楽譜アップロード(モーダル) =====
const scoreModalHymn = ref<{ id: string; nameKr: string } | null>(null);
const onScoreUploaded = (id: string) => {
  void invalidateHymns(queryClient);
  // 調の一覧も変わるので、この曲のキャッシュを捨てる
  void invalidateScoreKeys(queryClient, id);
};

const onDelete = async (item: HymnSummary) => {
  try {
    await api.get(`/hymns/${item.id}/delete-check`);
  } catch (e: unknown) {
    feedback.toast(extractErrorMessage(e, "削除できません"));
    return;
  }
  const ok = await feedback.confirm(
    `この「${item.nameJp}」という歌の情報を削除してもよろしいですか？`,
    "メッセージ",
  );
  if (!ok) return;
  try {
    const { headers } = await api.delete(`/hymns/${item.id}`);
    feedback.toast(String(headers["x-page-num"] ?? "削除しました"));
    void invalidateHymns(queryClient);
  } catch (e: unknown) {
    feedback.toast(extractErrorMessage(e, "削除に失敗しました"));
  }
};

// 検索にヒットした全件(ページ横断)のうち、一致(BURGUNDY)・よく一致(CADMIUM)の曲で
// YouTube プレイリストを作成する。全件を取り直して ID を集めるのはサーバー側が行う
// (検索条件だけを送る。曲が増えても画面の通信量が膨らまないように)。
const onCreatePlaylist = () =>
  playlist.create(async () => {
    if (totalRecords.value === 0) {
      feedback.toast("対象の賛美歌がありません");
      return null;
    }
    return { keyword: submittedKeyword.value };
  });

const fetchKeys = (id: string) => fetchScoreKeysOrToast(queryClient, id);
</script>

<template>
  <div class="hymn-list">
    <PageBackground src="/assets/mainmenu-bg5.webp" />

    <div class="hymnlist-card glass-panel">
      <div class="hymn-list__header noto-serif">
        <v-icon icon="mdi-view-grid-outline" size="20" class="mr-2" />
        <h1 class="text-title-large">賛美歌情報メンテナンス</h1>
      </div>

      <div class="pa-6">
        <div class="hymn-list__toolbar mb-4">
          <form role="search" class="hymn-list__search" @submit.prevent="onSearch">
            <v-text-field
              v-model="keyword"
              type="text"
              placeholder="キーワードを入力してください"
              aria-label="キーワード"
              variant="outlined"
              density="compact"
              bg-color="white"
              color="primary"
              hide-details
            >
              <template #append-inner>
                <v-btn icon="mdi-magnify" type="submit" size="x-small" variant="text" aria-label="検索" />
              </template>
            </v-text-field>
          </form>

          <!-- 韓国語名列に対応する空セル(グリッド比率合わせのためのスペーサー) -->
          <div />

          <!-- 操作列と同じ幅のセルに収め、列内で中央寄せにする -->
          <div class="d-flex align-center justify-center ga-2">
            <v-btn color="success" variant="flat" class="font-weight-bold" prepend-icon="mdi-plus-circle-outline"
              @click="formModal = { mode: 'add' }">
              賛美歌情報追加
            </v-btn>
            <Hint v-slot="{ props }" label="プレイリスト作成">
              <v-btn
                v-bind="props"
                icon="mdi-playlist-music"
                color="primary"
                variant="flat"
                size="small"
                rounded="md"
                aria-label="プレイリスト作成"
                :loading="playlist.creating.value"
                @click="onCreatePlaylist"
              />
            </Hint>
          </div>
        </div>

        <div class="hymn-list__table-wrap">
          <v-table class="hymn-list__table" density="comfortable">
            <colgroup>
              <col style="width: 12%" />
              <col style="width: 34%" />
              <col style="width: 30%" />
              <col style="width: 24%" />
            </colgroup>
            <thead>
              <tr>
                <th>{{ isSearching ? "一致度" : "番号" }}</th>
                <th>曲名</th>
                <th>韓国語名</th>
                <th class="text-center">操作</th>
              </tr>
            </thead>
            <tbody class="noto-serif">
              <!-- 初回読み込み中はスケルトン行(ページ切替中は keepPreviousData で前の行を薄く残す) -->
              <template v-if="isFetching && records.length === 0">
                <tr v-for="i in pageSize" :key="`skeleton-${i}`">
                  <td><v-skeleton-loader type="text" width="32" /></td>
                  <td><v-skeleton-loader type="text" width="75%" /></td>
                  <td><v-skeleton-loader type="text" width="66%" /></td>
                  <td><v-skeleton-loader type="button" width="128" class="mx-auto" /></td>
                </tr>
              </template>
              <tr v-else-if="!isFetching && records.length === 0">
                <td colspan="4" class="py-6 text-center text-disabled">データがありません</td>
              </tr>
              <!-- 行をクリック(またはEnter)すると YouTube を新しいタブで開く -->
              <tr
                v-for="(row, i) in records"
                :key="row.id"
                :tabindex="row.link ? 0 : undefined"
                :aria-label="row.link ? `${row.nameJp}をYouTubeで開く` : undefined"
                :class="['hymn-list__row', { 'is-link': row.link, 'is-stale': isFetching }]"
                @click="openYoutube(row)"
                @keydown.enter.self="openYoutube(row)"
              >
                <td>
                  <span v-if="isSearching" :class="['match-chip', matchLevel(row).chip]">
                    {{ matchLevel(row).label }}
                  </span>
                  <span v-else class="hymn-list__no">{{ rowNumber(i) }}</span>
                </td>
                <!-- 長い名称は文字サイズを縮小。2行まで折り返し、それ以上は「…」で省略(省略時のみホバーで全文) -->
                <td class="hymn-list__name">
                  <ClampText :text="row.nameJp" :class="hymnNameSizeClass(row.nameJp)" />
                </td>
                <td class="hymn-list__name hymn-list__name--kr">
                  <ClampText :text="row.nameKr" :class="hymnNameSizeClass(row.nameKr)" />
                </td>
                <!-- 操作列のクリックは行(YouTube)へ伝えない -->
                <td @click.stop @keydown.stop>
                  <div class="d-flex justify-center ga-1">
                    <Hint v-slot="{ props }" label="楽譜アップロード">
                      <v-btn v-bind="props" icon="mdi-music" class="action-btn" aria-label="楽譜アップロード"
                        @click="scoreModalHymn = { id: row.id, nameKr: row.nameKr }" />
                    </Hint>
                    <Hint v-slot="{ props }" label="編集">
                      <v-btn v-bind="props" icon="mdi-notebook-edit-outline" class="action-btn" aria-label="編集"
                        @click="formModal = { mode: 'edit', id: row.id }" />
                    </Hint>
                    <Hint v-slot="{ props }" label="削除">
                      <v-btn v-bind="props" icon="mdi-trash-can-outline" class="action-btn text-red-darken-1"
                        aria-label="削除" @click="onDelete(row)" />
                    </Hint>
                    <!-- 楽譜が複数あるときは、アイコンの右にふきだしで調を選ばせる -->
                    <ScoreKeyPopover
                      :id="row.id"
                      v-slot="{ onClick, loading, open, anchorRef }"
                      :fetch-keys="fetchKeys"
                      :download="downloadScoreOrToast"
                      side="right"
                    >
                      <Hint v-slot="{ props }" label="楽譜をダウンロード">
                        <v-btn
                          v-bind="props"
                          :ref="anchorRef"
                          icon="mdi-file-download-outline"
                          class="action-btn"
                          :loading="loading"
                          aria-label="楽譜をダウンロード"
                          aria-haspopup="menu"
                          :aria-expanded="open"
                          @click="onClick"
                        />
                      </Hint>
                    </ScoreKeyPopover>
                  </div>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>

        <!-- ページネーション -->
        <div class="hymn-list__pager mt-3">
          <div>全{{ totalRecords }}件 / {{ page }} / {{ totalPages }}ページ</div>
          <div class="d-flex align-center flex-wrap ga-3">
            <v-select
              :model-value="pageSize"
              :items="PAGE_SIZE_OPTIONS"
              aria-label="1ページの件数"
              variant="outlined"
              density="compact"
              bg-color="white"
              color="primary"
              hide-details
              class="hymn-list__size"
              @update:model-value="onPageSizeChange"
            />
            <v-pagination
              v-model="page"
              :length="totalPages"
              :total-visible="5"
              density="compact"
              active-color="primary"
              variant="flat"
              size="small"
              rounded="md"
              class="hymn-list__pagination"
              aria-label="ページ"
            />
          </div>
        </div>
      </div>
    </div>

    <HymnFormModal
      v-if="formModal"
      :key="formModal.mode === 'edit' ? formModal.id : 'add'"
      :mode="formModal.mode"
      :edit-id="formModal.mode === 'edit' ? formModal.id : undefined"
      :page-size="pageSize"
      @close="formModal = null"
      @saved="onFormSaved"
    />

    <HymnScoreModal
      v-if="scoreModalHymn"
      :hymn-id="scoreModalHymn.id"
      :hymn-name-kr="scoreModalHymn.nameKr"
      @close="scoreModalHymn = null"
      @uploaded="onScoreUploaded(scoreModalHymn.id)"
    />
  </div>
</template>

<style scoped>
.hymn-list {
  position: relative;
  min-height: 100%;
}
.hymnlist-card {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
}
.hymn-list__header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #1f2937;
  color: #fff;
}
.hymn-list__toolbar {
  display: grid;
  /* 表の列(12% / 34% / 30% / 24%)に合わせつつ、狭い画面ではボタンが切れないよう右端の列は内容の幅まで広がる */
  grid-template-columns: 12% 34% minmax(0, 1fr) minmax(24%, max-content);
  align-items: center;
  gap: 8px;
}
.hymn-list__search {
  grid-column: span 2;
  max-width: 480px;
}
.hymn-list__table-wrap {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}
.hymn-list__table {
  table-layout: fixed;
}
.hymn-list__table :deep(table) {
  table-layout: fixed;
}
.hymn-list__table thead th {
  padding: 0 12px !important;
  background: #f9fafb;
  font-weight: 700 !important;
  color: #4b5563 !important;
}
.hymn-list__table tbody td {
  padding: 8px 12px !important;
  font-weight: 500;
}
.hymn-list__row:hover {
  filter: brightness(0.97);
}
.hymn-list__row.is-link {
  cursor: pointer;
}
.hymn-list__row.is-stale {
  opacity: 0.5;
}
.hymn-list__no {
  font-weight: 700;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}
/* 名称列: 2行まで折り返す。日本語は禁則処理、韓国語は単語(空白)単位、空白の無い長い英数字だけ強制改行 */
.hymn-list__name {
  white-space: normal;
  line-height: 1.4;
  line-break: strict;
  overflow-wrap: anywhere;
}
.hymn-list__name--kr {
  word-break: keep-all;
}
.match-chip {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}
.match-chip--cadmium {
  background: #d1fae5;
  color: #065f46;
}
.match-chip--burgundy {
  background: #ffe4e6;
  color: #800020;
}
.match-chip--naples {
  background: #fef3c7;
  color: #78350f;
}
.match-chip--related {
  background: #f3f4f6;
  color: #4b5563;
}
/* 操作列のアイコンボタン(白地・薄い枠・角丸の正方形) */
.action-btn {
  width: 32px !important;
  height: 32px !important;
  border: 1px solid #e5e7eb;
  border-radius: 8px !important;
  background: #fff;
  color: #374151;
  box-shadow: none !important;
  font-size: 0.75rem;
}
.hymn-list__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.875rem;
  color: #4b5563;
}
.hymn-list__size {
  width: 168px;
  flex: none;
}
.hymn-list__pagination {
  padding: 2px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
}
</style>
