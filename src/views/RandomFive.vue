<script setup lang="ts">
// src/views/RandomFive.vue
// 旧 views/RandomFive.tsx を移植
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { LayoutGrid, Search, LoaderCircle } from "@lucide/vue";
import api from "@/api/axios";
import { useFeedbackStore } from "@/stores/feedback";
import { EMPTY_STRING, extractErrorMessage } from "@/constants";
import bgImage from "@/assets/mainmenu-bg6.webp";

type HymnRecord = { id?: number; nameJp: string; nameKr: string; link: string };

const route = useRoute();
const feedback = useFeedbackStore();

const keyword = ref(EMPTY_STRING);
const records = ref<HymnRecord[]>([]);
const loading = ref(false);

const onRandom = async () => {
  loading.value = true;
  try {
    const { data } = await api.get("/hymns/random-retrieve", {
      params: { keyword: keyword.value.normalize("NFC") },
    });
    records.value = data;
  } catch (e: unknown) {
    feedback.toast(extractErrorMessage(e, "通信エラー"));
  } finally {
    loading.value = false;
  }
};

const onNavSearch = async (kw: string) => {
  loading.value = true;
  try {
    const { data } = await api.get("/common/search", {
      params: { keyword: kw.normalize("NFC") },
    });
    records.value = data;
  } catch (e: unknown) {
    feedback.toast(extractErrorMessage(e, "通信エラー"));
  } finally {
    loading.value = false;
  }
};

// ナビバーの検索ボックスから ?keyword=xxx 付きで遷移してきた場合、自動検索
onMounted(() => {
  const q = route.query.keyword;
  if (typeof q === "string" && q) {
    keyword.value = q;
    onNavSearch(q);
  }
});

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Enter") onRandom();
};
</script>

<template>
  <div
    class="relative min-h-[calc(100vh-54px)] bg-cover bg-center bg-fixed"
  >
    <div class="fixed inset-0 -z-10">
      <img :src="bgImage" alt="" class="h-full w-full object-cover" />
    </div>

    <div class="randomfive-card noto-serif relative mt-2 overflow-hidden rounded-[18px]">
      <div class="flex items-center bg-gray-800 px-4 py-3 text-white">
        <LayoutGrid class="mr-2 h-5 w-5" />
        <h1 class="text-lg font-semibold">賛美歌ランドム選択</h1>
      </div>

      <div class="p-6">
        <div class="mb-6 flex justify-center">
          <div class="relative w-full max-w-[480px]">
            <input
              v-model="keyword"
              type="text"
              placeholder="キーワードを入力してください"
              class="w-full rounded-md border border-gray-300 py-1.5 pl-3 pr-9 text-sm outline-none focus:border-primary"
              @keydown="onKeyDown"
            />
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              @click="onRandom"
            >
              <Search class="h-4 w-4" />
            </button>
          </div>
        </div>

        <table class="glass-table">
          <caption>ランドム選択した賛美歌情報一覧</caption>
          <thead>
            <tr class="header-row-mint">
              <th>名称</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading" class="body-row-glass">
              <td class="py-4 text-center">
                <LoaderCircle class="inline-block h-4 w-4 animate-spin" />
              </td>
            </tr>
            <tr v-else-if="records.length === 0" class="body-row-glass">
              <td class="py-4 text-center">該当データなし</td>
            </tr>
            <template v-else>
              <tr
                v-for="item in records"
                :key="item.id ?? item.nameJp"
                class="body-row-glass"
              >
                <td class="text-center">
                  <a
                    :href="item.link"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="record-link"
                  >
                    {{ item.nameJp }} / {{ item.nameKr }}
                  </a>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.noto-serif,
.noto-serif * {
  font-family: "Noto Serif JP", serif !important;
}

.randomfive-card {
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

.randomfive-card::before {
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

.randomfive-card:hover::before {
  opacity: 1;
  animation: rotate-border 3300ms linear infinite;
}

@keyframes rotate-border {
  to {
    --angle: 360deg;
  }
}

.glass-table {
  width: 100%;
  background: transparent;
  border-collapse: separate;
  border-spacing: 0 6px;
}

.glass-table caption {
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.6);
  padding-bottom: 4px;
}

.header-row-mint th {
  background: rgba(168, 230, 196, 0.5);
  padding: 8px;
}

.body-row-glass td {
  background: rgba(255, 255, 255, 0.33);
  backdrop-filter: blur(10px) saturate(160%);
  -webkit-backdrop-filter: blur(10px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.4);
  padding: 10px;
}

.record-link {
  color: #006b3c;
  font-weight: 600;
  text-decoration: none;
}

.record-link:hover {
  text-decoration: underline;
}
</style>
