<script setup lang="ts">
// src/views/HymnList.vue
// 旧 views/HymnList.tsx を移植
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/vue-query";
import { LayoutGrid, CirclePlus, Search } from "@lucide/vue";
import api from "@/api/axios";
import { useFeedbackStore } from "@/stores/feedback";
import { EMPTY_STRING, extractErrorMessage, utf8ToBase64 } from "@/constants";
import bgImage from "@/assets/mainmenu-bg5.webp";

type HymnRow = {
  id: number;
  nameJp: string;
  nameKr: string;
  link: string;
  lineNumber: string;
};

const textSizeClass = (str: string) => {
  const len = (str ?? EMPTY_STRING).length;
  if (len >= 33) return "hymn-text-xs";
  if (len >= 19) return "hymn-text-sm";
  return EMPTY_STRING;
};

const rowClass = (line: string) =>
  ({
    BURGUNDY: "row-burgundy",
    NAPLES: "row-naples",
    CADMIUM: "row-cadmium",
  })[line] ?? EMPTY_STRING;

const route = useRoute();
const router = useRouter();
const feedback = useFeedbackStore();
const queryClient = useQueryClient();

const asStr = (v: unknown) => (typeof v === "string" ? v : EMPTY_STRING);

const page = ref(Number(route.query.pageNum) || 1);
const pageSize = ref(Number(route.query.pageSize) || 10);
const keyword = ref(asStr(route.query.keyword));
const submittedKeyword = ref(asStr(route.query.keyword));

const { data, isFetching } = useQuery({
  queryKey: computed(() => [
    "hymns-list",
    page.value,
    pageSize.value,
    submittedKeyword.value,
  ]),
  queryFn: async () => {
    const { data } = await api.get("/hymns/pagination", {
      params: {
        pageNum: page.value,
        pageSize: pageSize.value,
        keyword: submittedKeyword.value.normalize("NFC"),
      },
    });
    return data as { records: HymnRow[]; totalRecords: number };
  },
  placeholderData: keepPreviousData,
});

const records = computed(() => data.value?.records ?? []);
const totalRecords = computed(() => data.value?.totalRecords ?? 0);
const pageSizeOptions = [5, 10, 15];
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalRecords.value / pageSize.value)),
);

const onSearch = () => {
  page.value = 1;
  submittedKeyword.value = keyword.value;
};

const onSearchKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Enter") onSearch();
};

const goAdd = () =>
  router.push(`/hymns/add?pageNum=${page.value}&pageSize=${pageSize.value}`);

const goEdit = (id: number) =>
  router.push(
    `/hymns/edit?editId=${id}&pageNum=${page.value}&pageSize=${pageSize.value}&keyword=${encodeURIComponent(submittedKeyword.value)}`,
  );

const goScore = (id: number) =>
  router.push(
    `/hymns/score?scoreId=${id}&pageNum=${page.value}&pageSize=${pageSize.value}&keyword=${encodeURIComponent(submittedKeyword.value)}`,
  );

const onDelete = async (item: HymnRow) => {
  try {
    await api.get(`/hymns/delete-check?id=${item.id}`);
  } catch (e: unknown) {
    feedback.toast(extractErrorMessage(e, "削除できません"));
    return;
  }
  const ok = await feedback.confirm(
    `この「${item.nameJp}」という歌の情報を削除するとよろしいでしょうか。`,
    "メッセージ",
  );
  if (!ok) return;
  try {
    const { data } = await api.delete(`/hymns/info-delete?id=${item.id}`);
    feedback.toast(data.message ?? "削除しました");
    queryClient.invalidateQueries({ queryKey: ["hymns-list"] });
  } catch (e: unknown) {
    feedback.toast(extractErrorMessage(e, "削除に失敗しました"));
  }
};

const downloadScore = async (id: number) => {
  try {
    const res = await api.get(`/hymns/score-download?id=${id}`, {
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
    const msg = extractErrorMessage(e, "楽譜の取得に失敗しました");
    router.push(`/error?errMsg=${encodeURIComponent(utf8ToBase64(msg))}`);
  }
};

const onPageSizeChange = (e: Event) => {
  pageSize.value = Number((e.target as HTMLSelectElement).value);
  page.value = 1;
};
</script>

<template>
  <div
    class="relative min-h-[calc(100vh-54px)] bg-cover bg-center bg-fixed"
  >
    <div class="fixed inset-0 -z-10">
      <img :src="bgImage" alt="" class="h-full w-full object-cover" />
    </div>

    <div class="hymnlist-card relative mt-2 overflow-hidden rounded-[18px]">
      <div class="noto-serif flex items-center bg-gray-800 px-4 py-3 text-white">
        <LayoutGrid class="mr-2 h-5 w-5" />
        <h1 class="text-lg font-semibold">賛美歌情報メンテナンス</h1>
      </div>

      <div class="p-6">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <div class="relative w-full md:w-[42%]">
            <input
              v-model="keyword"
              type="text"
              placeholder="キーワードを入力してください"
              class="w-full rounded-md border border-gray-300 py-1.5 pl-3 pr-9 text-sm outline-none focus:border-primary"
              @keydown="onSearchKeyDown"
            />
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              @click="onSearch"
            >
              <Search class="h-4 w-4" />
            </button>
          </div>

          <div class="ml-auto">
            <button
              type="button"
              class="flex items-center gap-1 rounded-md bg-success px-4 py-1.5 text-sm font-medium text-white"
              @click="goAdd"
            >
              <CirclePlus class="h-4 w-4" /> 賛美歌情報追加
            </button>
          </div>
        </div>

        <div class="overflow-x-auto rounded-md border border-gray-200">
          <table class="hymn-table w-full table-fixed text-sm">
            <colgroup>
              <col style="width: 30%" />
              <col style="width: 26%" />
              <col style="width: 10%" />
              <col style="width: 10%" />
              <col style="width: 24%" />
            </colgroup>
            <thead class="bg-gray-50 text-gray-600">
              <tr>
                <th class="px-3 py-2 text-left">名称</th>
                <th class="px-3 py-2 text-left">韓国語名称</th>
                <th class="px-3 py-2 text-center">リンク</th>
                <th class="px-3 py-2 text-center">楽譜</th>
                <th class="px-3 py-2 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="isFetching && records.length === 0">
                <td colspan="5" class="px-3 py-6 text-center text-gray-400">
                  読み込み中...
                </td>
              </tr>
              <tr v-else-if="records.length === 0">
                <td colspan="5" class="px-3 py-6 text-center text-gray-400">
                  データがありません
                </td>
              </tr>
              <tr
                v-for="row in records"
                :key="row.id"
                :class="rowClass(row.lineNumber)"
              >
                <td class="col-name px-3 py-2" :class="textSizeClass(row.nameJp)">
                  {{ row.nameJp }}
                </td>
                <td class="col-name px-3 py-2" :class="textSizeClass(row.nameKr)">
                  {{ row.nameKr }}
                </td>
                <td class="px-3 py-2 text-center">
                  <a :href="row.link" target="_blank" rel="noopener noreferrer">Link</a>
                </td>
                <td class="px-3 py-2 text-center">
                  <a href="#" @click.prevent="downloadScore(row.id)">𝄞</a>
                </td>
                <td class="px-3 py-2">
                  <div class="flex justify-center gap-1">
                    <button
                      class="rounded bg-secondary px-2 py-1 text-xs text-white"
                      @click="goScore(row.id)"
                    >
                      楽譜
                    </button>
                    <button
                      class="rounded bg-primary px-2 py-1 text-xs text-white"
                      @click="goEdit(row.id)"
                    >
                      編集
                    </button>
                    <button
                      class="rounded bg-warning px-2 py-1 text-xs text-gray-900"
                      @click="onDelete(row)"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 簡易ページネーション(旧 DataGrid の paginationMode="server" 相当) -->
        <div class="mt-3 flex items-center justify-between text-sm text-gray-600">
          <div>
            全{{ totalRecords }}件 / {{ page }} / {{ totalPages }}ページ
          </div>
          <div class="flex items-center gap-2">
            <select
              :value="pageSize"
              class="rounded border border-gray-300 px-2 py-1"
              @change="onPageSizeChange"
            >
              <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">
                {{ opt }}件/ページ
              </option>
            </select>
            <button
              class="rounded px-2 py-1 disabled:opacity-40"
              :disabled="page <= 1"
              @click="page -= 1"
            >
              ←
            </button>
            <button
              class="rounded px-2 py-1 disabled:opacity-40"
              :disabled="page >= totalPages"
              @click="page += 1"
            >

            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 旧 views/HymnList.css を移植 */
.noto-serif,
.noto-serif * {
  font-family: "Noto Serif JP", serif !important;
}

.hymnlist-card {
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

@property --angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

.hymnlist-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 2px;
  background: conic-gradient(
    from var(--angle),
    transparent 0deg,
    transparent 270deg,
    #353542 320deg,
    #6e6e80 350deg,
    #353542 360deg
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

.hymnlist-card:hover::before {
  opacity: 1;
  animation: rotate-border 3300ms linear infinite;
}

@keyframes rotate-border {
  to {
    --angle: 360deg;
  }
}

.col-name {
  word-break: break-all;
  white-space: normal;
  line-height: 1.4;
}

.hymn-text-sm {
  font-size: 0.67em !important;
}

.hymn-text-xs {
  font-size: 0.33em !important;
}

.hymn-table :deep(.row-burgundy) {
  background-color: #ffebee;
}

.hymn-table :deep(.row-naples) {
  background-color: #fffde7;
}

.hymn-table :deep(.row-cadmium) {
  background-color: #e8f5e9;
}

.hymn-table :deep(tr:hover) {
  filter: brightness(0.97);
}
</style>
