<script setup lang="ts">
// src/views/HymnScore.vue
// 旧 views/HymnScore.tsx を移植
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import api from "@/api/axios";
import { useFeedbackStore } from "@/stores/feedback";
import { EMPTY_STRING, extractErrorMessage } from "@/constants";
import bgImage from "@/assets/mainmenu-bg2.webp";

const route = useRoute();
const router = useRouter();
const feedback = useFeedbackStore();
const fileInput = ref<HTMLInputElement | null>(null);

const asStr = (v: unknown) => (typeof v === "string" ? v : EMPTY_STRING);

const scoreId = asStr(route.query.scoreId);
const pageNum = asStr(route.query.pageNum);
const pageSize = asStr(route.query.pageSize);
const keyword = asStr(route.query.keyword);

const file = ref<File | null>(null);
const error = ref(EMPTY_STRING);
const uploading = ref(false);
// 元の実装同様、進捗値は保持するのみでUIには表示していない
const progress = ref(0);

const buildListQuery = () => {
  const qs = new URLSearchParams();
  if (pageNum) qs.set("pageNum", pageNum);
  if (pageSize) qs.set("pageSize", pageSize);
  if (keyword) qs.set("keyword", keyword);
  return qs.toString();
};

const onFilePick = (e: Event) => {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null;
  error.value = EMPTY_STRING;
};

const onUpload = async () => {
  if (!file.value) {
    error.value = "ファイルを選択してください。";
    return;
  }
  const formData = new FormData();
  formData.append("id", scoreId ?? EMPTY_STRING);
  formData.append("score", file.value);
  const controller = new AbortController();
  uploading.value = true;
  progress.value = 0;
  try {
    const { data } = await api.post("/hymns/score-upload", formData, {
      signal: controller.signal,
      timeout: 66_000,
      onUploadProgress: (evt) => {
        if (evt.total) {
          progress.value = Math.round((evt.loaded / evt.total) * 100);
        }
      },
    });
    feedback.toast(typeof data === "string" ? data : "アップロードしました");
    router.push(`/hymns?${buildListQuery()}`);
  } catch (e: unknown) {
    if (axios.isCancel(e)) {
      feedback.toast("アップロードをキャンセルしました");
    } else {
      feedback.toast(extractErrorMessage(e, "通信エラーが発生しました。"));
    }
  } finally {
    uploading.value = false;
  }
};
</script>

<template>
  <div
    class="noto-sans relative -m-6 min-h-[calc(100vh-48px)] bg-cover bg-center bg-fixed p-4"
  >
    <div class="fixed inset-0 -z-10">
      <img :src="bgImage" alt="" class="h-full w-full object-cover" />
    </div>

    <nav class="mb-2 text-sm font-semibold text-[#fffff0]">
      <RouterLink to="/mainmenu" class="hover:underline">メインメニュー</RouterLink>
      <span class="mx-1">/</span>
      <RouterLink :to="`/hymns?${buildListQuery()}`" class="hover:underline">データリスト</RouterLink>
      <span class="mx-1">/</span>
      <span>楽譜アプロード</span>
    </nav>

    <div class="score-card relative overflow-hidden rounded-[18px]">
      <div class="flex items-center bg-secondary px-4 py-3 text-white">
        <span class="mr-2">▦</span>
        <h1 class="text-lg font-semibold">賛美歌楽譜アプロード</h1>
      </div>

      <div class="flex flex-col items-center gap-2 p-8 sm:flex-row sm:justify-center">
        <span class="sm:text-right">楽譜</span>
        <div>
          <input
            ref="fileInput"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.svg"
            class="hidden"
            @change="onFilePick"
          />
          <button
            type="button"
            class="rounded-md border border-secondary px-4 py-1.5 text-sm font-medium text-secondary"
            @click="fileInput?.click()"
          >
            ⬆ ファイルを選択
          </button>
          <p v-if="file" class="mt-1 text-sm text-gray-600">
            {{ file.name }}({{ Math.round(file.size / 1024) }} KB)
          </p>
          <p v-if="error" class="mt-1 text-sm text-red-600">{{ error }}</p>
        </div>
      </div>

      <div class="flex justify-end px-6 pb-4">
        <button
          type="button"
          class="rounded-md bg-secondary px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          :disabled="uploading"
          @click="onUpload"
        >
          <span v-if="uploading" class="inline-block animate-spin">⟳</span>
          <span v-else>⬆ アプロード</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.noto-sans,
.noto-sans * {
  font-family: "Noto Sans JP", sans-serif !important;
}

.score-card {
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

.score-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 2px;
  background: conic-gradient(
    from var(--angle),
    transparent 0deg,
    transparent 270deg,
    #002fa7 320deg,
    #4d74d1 350deg,
    #002fa7 360deg
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

.score-card:hover::before {
  opacity: 1;
  animation: rotate-border 3300ms linear infinite;
}

@keyframes rotate-border {
  to {
    --angle: 360deg;
  }
}
</style>
