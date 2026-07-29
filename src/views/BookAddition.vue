<script setup lang="ts">
// src/views/BookAddition.vue
// 旧 views/BookAddition.tsx を移植
import { reactive, ref, watch, onMounted } from "vue";
import api from "@/api/axios";
import { useFeedbackStore } from "@/stores/feedback";
import { EMPTY_STRING, extractErrorMessage } from "@/constants";
import bgImage from "@/assets/mainmenu-bg.webp";
import RedLetterEditor from "@/components/RedLetterEditor.vue";

type BookOrChapter = { id: number; name: string };

const required = (v: string) => !!v && v.trim() !== EMPTY_STRING;

const feedback = useFeedbackStore();

const books = ref<BookOrChapter[]>([]);
const chapters = ref<BookOrChapter[]>([]);
const bookId = ref<number | string>(EMPTY_STRING);
const chapterId = ref<number | string>(EMPTY_STRING);
const verseId = ref(EMPTY_STRING);
const textEn = ref(EMPTY_STRING);
const textJp = ref(EMPTY_STRING);
const chapterLoading = ref(false);
const saving = ref(false);
const errors = reactive({ textEn: false, textJp: false, verseId: false });

const textEnEditorRef = ref<InstanceType<typeof RedLetterEditor> | null>(null);
const textJpEditorRef = ref<InstanceType<typeof RedLetterEditor> | null>(null);

// 初期表示: 書一覧を取得
onMounted(async () => {
  try {
    const { data } = await api.get("/books/get-books");
    books.value = data;
    if (data.length) bookId.value = data[0].id;
  } catch (e: unknown) {
    feedback.toast(extractErrorMessage(e, "書の取得に失敗しました"));
  }
});

// 書が変わったら章を取り直す(連動の核心)
watch(bookId, async (id) => {
  chapterId.value = EMPTY_STRING;
  chapters.value = [];
  if (!id) return;
  chapterLoading.value = true;
  try {
    const { data } = await api.get("/books/get-chapters", {
      params: { bookId: id },
    });
    chapters.value = data;
    if (data.length) chapterId.value = data[0].id;
  } catch (e: unknown) {
    feedback.toast(extractErrorMessage(e, "章の取得に失敗しました"));
  } finally {
    chapterLoading.value = false;
  }
});

// 入力中でも該当欄が埋まった時点でアラート(エラー表示)を消す
const handleTextEnChange = (v: string) => {
  textEn.value = v;
  if (required(v)) errors.textEn = false;
};

const handleTextJpChange = (v: string) => {
  textJp.value = v;
  if (required(v)) errors.textJp = false;
};

const handleVerseIdChange = (v: string) => {
  verseId.value = v;
  if (required(v)) errors.verseId = false;
};

const onWrapSelection = () => {
  textEnEditorRef.value?.wrapSelection();
  textJpEditorRef.value?.wrapSelection();
};

const onStore = async () => {
  const nextErrors = {
    textEn: !required(textEn.value),
    textJp: !required(textJp.value),
    verseId: !required(verseId.value),
  };
  Object.assign(errors, nextErrors);
  if (Object.values(nextErrors).some(Boolean)) {
    feedback.toast("入力情報不正");
    return;
  }
  saving.value = true;
  try {
    const { data } = await api.post("/books/info-storage", {
      chapterId: chapterId.value,
      id: verseId.value.trim(),
      textEn: textEn.value.trim(),
      textJp: textJp.value.trim(),
    });
    feedback.toast(typeof data === "string" ? data : "追加済み");
    verseId.value = EMPTY_STRING;
    textEn.value = EMPTY_STRING;
    textJp.value = EMPTY_STRING;
    Object.assign(errors, { textEn: false, textJp: false, verseId: false });
  } catch (e: unknown) {
    feedback.toast(extractErrorMessage(e, "保存に失敗しました"));
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div
    class="relative -m-6 min-h-[calc(100vh-48px)] bg-cover bg-center bg-fixed p-4"
  >
    <div class="fixed inset-0 -z-10">
      <img :src="bgImage" alt="" class="h-full w-full object-cover" />
    </div>

    <div class="bookaddition-card noto-serif relative mt-2 overflow-hidden rounded-[18px]">
      <div class="noto-serif flex items-center bg-gray-800 px-4 py-3 text-white">
        <span class="mr-2">📖</span>
        <h1 class="text-lg font-semibold">聖書章節入力</h1>
      </div>

      <div class="p-6">
        <div class="mb-2 flex items-start gap-4">
          <div class="label-text w-16 shrink-0 pt-2">英語</div>
          <div class="flex-1">
            <RedLetterEditor
              ref="textEnEditorRef"
              :model-value="textEn"
              :error="errors.textEn"
              :helper-text="errors.textEn ? '上記の入力ボックスを空になってはいけません。' : undefined"
              @update:model-value="handleTextEnChange"
            />
          </div>
        </div>

        <div class="mb-2 flex justify-start pl-16">
          <button
            type="button"
            class="rounded-full p-2 text-red-700 hover:bg-red-50"
            title="選択範囲を赤文字にする(再押下で解除)"
            @mousedown.prevent
            @click="onWrapSelection"
          >
            🖊
          </button>
        </div>

        <div class="mb-6 flex items-start gap-4">
          <div class="label-text w-16 shrink-0 pt-2">日本語</div>
          <div class="flex-1">
            <RedLetterEditor
              ref="textJpEditorRef"
              :model-value="textJp"
              :error="errors.textJp"
              :helper-text="errors.textJp ? '上記の入力ボックスを空になってはいけません。' : undefined"
              @update:model-value="handleTextJpChange"
            />
          </div>
        </div>

        <div class="flex flex-wrap items-start gap-3">
          <div class="w-full md:w-[22%]">
            <label class="noto-serif mb-1 block text-sm text-gray-600">書</label>
            <select
              v-model="bookId"
              class="noto-serif w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option v-for="b in books" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>

          <div class="w-full md:w-[30%]">
            <label class="noto-serif mb-1 flex items-center gap-1 text-sm text-gray-600">
              章
              <span v-if="chapterLoading" class="inline-block animate-spin text-xs">⟳</span>
            </label>
            <select
              v-model="chapterId"
              class="noto-serif w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option v-for="c in chapters" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <div class="w-full md:w-[22%]">
            <label class="noto-serif mb-1 block text-sm text-gray-600">節</label>
            <input
              :value="verseId"
              type="text"
              placeholder="節の数を入力しましょう"
              class="noto-serif w-full rounded-md border px-2 py-1.5 text-sm outline-none"
              :class="errors.verseId ? 'border-red-400' : 'border-gray-300 focus:border-primary'"
              @input="handleVerseIdChange(($event.target as HTMLInputElement).value)"
            />
            <p v-if="errors.verseId" class="mt-1 text-xs text-red-600">
              上記の入力ボックスを空になってはいけません。
            </p>
          </div>

          <div class="w-full md:w-[16%]">
            <label class="mb-1 block text-sm text-transparent">追加</label>
            <button
              type="button"
              class="noto-serif h-10 w-full rounded-md bg-primary text-sm font-medium text-white disabled:opacity-60"
              :disabled="saving"
              @click="onStore"
            >
              <span v-if="saving" class="inline-block animate-spin">⟳</span>
              <span v-else>📕 追加</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.noto-serif,
.noto-serif * {
  font-family: "Noto Serif JP", serif !important;
}

.label-text {
  font-weight: 600;
  font-size: 0.95rem;
  text-align: right;
}

.bookaddition-card {
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

.bookaddition-card::before {
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

.bookaddition-card:hover::before {
  opacity: 1;
  animation: rotate-border 3300ms linear infinite;
}

@keyframes rotate-border {
  to {
    --angle: 360deg;
  }
}
</style>
