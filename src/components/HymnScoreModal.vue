<script setup lang="ts">
// src/components/HymnScoreModal.vue
// 旧 views/HymnScore.vue（専用画面）をモーダル化したもの。
// HymnList.vue から表示する。ルーティングは行わない。
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import axios from "axios";
import { CloudUpload, LoaderCircle, X } from "@lucide/vue";
import api from "@/api/axios";
import { useFeedbackStore } from "@/stores/feedback";
import { EMPTY_STRING, extractErrorMessage } from "@/constants";

const props = defineProps<{
  hymnId: number;
  hymnNameKr: string;
}>();

const emit = defineEmits<{
  close: [];
  uploaded: [];
}>();

const title = computed(() => `楽譜-${props.hymnNameKr}`);

const feedback = useFeedbackStore();
const fileInput = ref<HTMLInputElement | null>(null);

const file = ref<File | null>(null);
const error = ref(EMPTY_STRING);
const uploading = ref(false);
// 元の実装同様、進捗値は保持するのみでUIには表示していない
const progress = ref(0);

const onFilePick = (e: Event) => {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null;
  error.value = EMPTY_STRING;
};

const close = () => {
  if (uploading.value) return; // アップロード中は誤って閉じられないようにする
  emit("close");
};

const onUpload = async () => {
  if (!file.value) {
    error.value = "ファイルを選択してください。";
    return;
  }
  const formData = new FormData();
  formData.append("score", file.value);
  const controller = new AbortController();
  uploading.value = true;
  progress.value = 0;
  try {
    const { data } = await api.post(`/hymns/${props.hymnId}/score`, formData, {
      signal: controller.signal,
      timeout: 66_000,
      onUploadProgress: (evt) => {
        if (evt.total) {
          progress.value = Math.round((evt.loaded / evt.total) * 100);
        }
      },
    });
    feedback.toast(typeof data === "string" ? data : "アップロードしました");
    emit("uploaded");
    emit("close");
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

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") close();
};

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="close"
    >
      <div
        class="score-modal noto-sans relative w-full max-w-md overflow-hidden rounded-[18px] bg-white"
        role="dialog"
        aria-modal="true"
      >
        <div class="bg-white pr-4 pt-3">
          <div class="flex items-center justify-between">
            <h2
              class="text-base font-semibold text-secondary"
              style="padding-left: 10px"
            >
              {{ title }}
            </h2>
            <button
              type="button"
              class="rounded p-1 text-secondary hover:bg-secondary/10 disabled:opacity-50"
              :disabled="uploading"
              aria-label="閉じる"
              @click="close"
            >
              <X class="h-5 w-5" />
            </button>
          </div>
          <div
            class="mt-2 h-0.75 rounded-full bg-secondary"
            style="margin-left: 6px; margin-right: 6px"
          ></div>
        </div>

        <div class="flex flex-col items-center gap-2 p-8">
          <input
            ref="fileInput"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.svg"
            class="hidden"
            @change="onFilePick"
          />
          <button
            type="button"
            class="flex items-center gap-1 rounded-md border border-secondary px-4 py-1.5 text-sm font-medium text-secondary"
            @click="fileInput?.click()"
          >
            <CloudUpload class="h-4 w-4" /> ファイルを選択
          </button>
          <p v-if="file" class="mt-1 text-sm text-gray-600">
            {{ file.name }}({{ Math.round(file.size / 1024) }} KB)
          </p>
          <p v-if="error" class="mt-1 text-sm text-red-600">{{ error }}</p>
        </div>

        <div class="flex justify-end px-6 pb-4">
          <button
            type="button"
            class="rounded-md bg-secondary px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            :disabled="uploading"
            @click="onUpload"
          >
            <LoaderCircle
              v-if="uploading"
              class="inline-block h-4 w-4 animate-spin"
            />
            <span v-else class="flex items-center gap-1">
              <CloudUpload class="h-4 w-4" /> アプロード
            </span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.noto-sans,
.noto-sans * {
  font-family: "Noto Sans JP", sans-serif !important;
}

.score-modal {
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}
</style>
