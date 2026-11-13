<script setup lang="ts">
// 聖書章節入力(旧 (admin)/books/add/page.tsx)
import { computed, reactive, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import api from "@/api/axios";
import { useFeedbackStore } from "@/stores/feedback";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { useDebouncedValue } from "@/composables/useDebouncedValue";
import { EMPTY_STRING, extractErrorMessage } from "@/lib/constants";
import PageBackground from "@/components/PageBackground.vue";
import Hint from "@/components/Hint.vue";
import RedLetterEditor from "@/components/RedLetterEditor.vue";
import BookCombobox from "@/components/BookCombobox.vue";

type BookOrChapter = { id: number; name: string };

/** 既存の節の本文(エディタに入れる形。英語の末尾の # は改行フラグを表す) */
type VerseText = { textEn: string; textJp: string };

/** 既存の節(VerseDTO の name は「章名:節番号」の表記。例: Psalms 23:1) */
type ExistingVerse = VerseText & { name: string };

/**
 * 既存の節の確認状態
 * idle: 章・節が未確定 / loading: 確認中 / found: 登録済み(更新になる)
 * none: 未登録(新規追加になる) / error: 確認に失敗
 */
type VerseLookup = "idle" | "loading" | "found" | "none" | "error";

/** 章・節を入力してから既存の節を問い合わせるまでの待ち時間(ms) */
const LOOKUP_DELAY = 300;
const REQUIRED_MESSAGE = "上記の入力ボックスを空になってはいけません。";

/** 空・空白だけでないか */
const isFilled = (v: string) => !!v && v.trim() !== EMPTY_STRING;

const feedback = useFeedbackStore();

// ユーザーが選んだ書・章。未選択(または一覧に無い)ときは先頭を使う(下の bookId / chapterId)
const pickedBookId = ref<number | string>(EMPTY_STRING);
const pickedChapterId = ref<number | string>(EMPTY_STRING);
const verseId = ref(EMPTY_STRING);
// ユーザーが入力した本文。null の間は「既存の節の本文(あれば)」を表示する
const edited = ref<VerseText | null>(null);
const saving = ref(false);
const errors = reactive({ textEn: false, textJp: false, verseId: false });
const confirmOpen = ref(false);

const textEnEditor = ref<InstanceType<typeof RedLetterEditor> | null>(null);
const textJpEditor = ref<InstanceType<typeof RedLetterEditor> | null>(null);

// ===== 書・章(書・章の一覧は変わらないので、一度取得したら再取得しない) =====
const booksQuery = useQuery({
  queryKey: ["books"],
  queryFn: async () => (await api.get<BookOrChapter[]>("/books")).data,
  staleTime: Infinity,
});
const books = computed(() => booksQuery.data.value ?? []);
const bookId = computed(
  () => pickedBookId.value || books.value[0]?.id || EMPTY_STRING,
);

const chaptersQuery = useQuery(
  computed(() => ({
    queryKey: ["chapters", String(bookId.value)],
    queryFn: async () =>
      (await api.get<BookOrChapter[]>(`/books/${bookId.value}/chapters`)).data,
    enabled: !!bookId.value,
    staleTime: Infinity,
  })),
);
const chapters = computed(() => chaptersQuery.data.value ?? []);
const chapterLoading = computed(
  () => !!bookId.value && chaptersQuery.isPending.value,
);
const chapterId = computed(() =>
  chapters.value.some((c) => String(c.id) === String(pickedChapterId.value))
    ? pickedChapterId.value
    : (chapters.value[0]?.id ?? EMPTY_STRING),
);

const bookModel = computed({
  get: () => bookId.value,
  set: (id) => {
    pickedBookId.value = id;
    pickedChapterId.value = EMPTY_STRING; // 書が変わったら章は先頭に戻す
  },
});
const chapterModel = computed({
  get: () => chapterId.value,
  set: (id) => {
    pickedChapterId.value = id;
  },
});

watch(booksQuery.error, (e) => {
  if (e) feedback.toast(extractErrorMessage(e, "書の取得に失敗しました"));
});
watch(chaptersQuery.error, (e) => {
  if (e) feedback.toast(extractErrorMessage(e, "章の取得に失敗しました"));
});

// ===== 既存の節の確認(章・節を入力して一定時間たったら問い合わせる) =====
// 登録済みなら編集モード(ボタンが「更新」になり、本文を読み込む)
const lookupVerse = computed(() => verseId.value.trim());
const lookupReady = computed(
  () => !!chapterId.value && /^\d+$/.test(lookupVerse.value),
);
const lookupKey = computed(() => `${chapterId.value}|${lookupVerse.value}`);
const debouncedKey = useDebouncedValue(lookupKey, LOOKUP_DELAY);
const verseQuery = useQuery(
  computed(() => ({
    queryKey: ["verse", debouncedKey.value],
    queryFn: async (): Promise<ExistingVerse | null> => {
      const [chapter, verse] = debouncedKey.value.split("|");
      // 登録済みなら1件、未登録なら空のリストが返る
      const { data } = await api.get(`/books/${chapter}/verse`, {
        params: { verseNo: verse },
      });
      const row = Array.isArray(data) ? data[0] : undefined;
      return row
        ? {
            name: row.name ?? EMPTY_STRING,
            textEn: row.textEn ?? EMPTY_STRING,
            textJp: row.textJp ?? EMPTY_STRING,
          }
        : null;
    },
    enabled: lookupReady.value && debouncedKey.value === lookupKey.value,
    gcTime: 0, // 節の内容は他の人が更新するかもしれないので、キャッシュは残さない
  })),
);
const lookup = computed<VerseLookup>(() => {
  if (!lookupReady.value) return "idle";
  if (debouncedKey.value !== lookupKey.value) return "loading"; // 入力が落ち着くのを待っている
  if (verseQuery.isError.value) return "error";
  if (verseQuery.isPending.value) return "loading";
  return verseQuery.data.value ? "found" : "none";
});
const existing = computed(() =>
  lookup.value === "found" ? (verseQuery.data.value ?? null) : null,
);

watch(verseQuery.error, (e) => {
  if (e) feedback.toast(extractErrorMessage(e, "既存の節の確認に失敗しました"));
});

// 画面に出す本文: 入力済みならそれ、未入力なら既存の節の本文(無ければ空)
const textEn = computed(() =>
  edited.value ? edited.value.textEn : (existing.value?.textEn ?? EMPTY_STRING),
);
const textJp = computed(() =>
  edited.value ? edited.value.textJp : (existing.value?.textJp ?? EMPTY_STRING),
);

// 編集内容があるか。本文が空、または既存の節から読み込んだままの未編集なら、なし。
// 編集内容があるまま、タブを閉じる・再読み込み・別サイトへ移動しようとしたらブラウザが確認する。
// 画面内の移動はルーターのガード(router/guards.ts)が確認する。
const isDirty = computed(
  () =>
    (isFilled(textEn.value) || isFilled(textJp.value)) &&
    !(
      existing.value &&
      textEn.value === existing.value.textEn &&
      textJp.value === existing.value.textJp
    ),
);
useUnsavedChanges(isDirty);

// 入力中でも該当欄が埋まった時点でアラート(エラー表示)を消す
const changeText = (next: Partial<VerseText>) => {
  const value: VerseText = {
    textEn: textEn.value,
    textJp: textJp.value,
    ...next,
  };
  // 両方空になったら「未入力」に戻す(節を変えたとき既存の本文が読み込まれる)
  edited.value =
    isFilled(value.textEn) || isFilled(value.textJp) ? value : null;
};
const textEnModel = computed({
  get: () => textEn.value,
  set: (v) => {
    changeText({ textEn: v });
    if (isFilled(v)) errors.textEn = false;
  },
});
const textJpModel = computed({
  get: () => textJp.value,
  set: (v) => {
    changeText({ textJp: v });
    if (isFilled(v)) errors.textJp = false;
  },
});
watch(verseId, (v) => {
  if (isFilled(v)) errors.verseId = false;
});

// 既存の節の本文を入力欄へ読み込む(入力済みの内容は捨てる)
const loadExisting = () => {
  edited.value = null;
  errors.textEn = false;
  errors.textJp = false;
};

const onWrapSelection = () => {
  textEnEditor.value?.wrapSelection();
  textJpEditor.value?.wrapSelection();
};

const doSave = async () => {
  confirmOpen.value = false;
  saving.value = true;
  try {
    const { data } = await api.post("/books", {
      chapterId: chapterId.value,
      id: verseId.value.trim(),
      textEn: textEn.value.trim(),
      textJp: textJp.value.trim(),
    });
    feedback.toast(typeof data === "string" ? data : "追加済み");
    verseId.value = EMPTY_STRING;
    edited.value = null;
    Object.assign(errors, { textEn: false, textJp: false, verseId: false });
  } catch (e: unknown) {
    feedback.toast(extractErrorMessage(e, "保存に失敗しました"));
  } finally {
    saving.value = false;
  }
};

const onStore = () => {
  Object.assign(errors, {
    textEn: !isFilled(textEn.value),
    textJp: !isFilled(textJp.value),
    verseId: !isFilled(verseId.value),
  });
  if (errors.textEn || errors.textJp || errors.verseId) {
    feedback.toast("入力情報不正");
    return;
  }
  // 登録済み(更新になる)場合、または既存かどうか確認できなかった場合は、上書き確認を出す
  if (lookup.value === "found" || lookup.value === "error") {
    confirmOpen.value = true;
    return;
  }
  void doSave();
};

const isUpdate = computed(() => lookup.value === "found");
// 入力内容が既存の節と違う(「既存の内容を読み込む」を出す)か
const differsFromExisting = computed(
  () =>
    !!existing.value &&
    (existing.value.textEn !== textEn.value ||
      existing.value.textJp !== textJp.value),
);
// 確認ダイアログに出す節の表記は VerseDTO の name を使う(無ければ入力値で代替)
const verseLabel = computed(
  () => existing.value?.name || `${verseId.value.trim()}節`,
);
const enError = computed(() => errors.textEn && !isFilled(textEn.value));
const jpError = computed(() => errors.textJp && !isFilled(textJp.value));
</script>

<template>
  <div class="book-addition">
    <PageBackground src="/assets/mainmenu-bg.webp" />

    <div class="bookaddition-card noto-serif glass-panel">
      <div class="book-addition__header">
        <v-icon icon="mdi-book-open-variant" size="20" class="mr-2" />
        <h1 class="text-title-large">聖書章節入力</h1>
      </div>

      <div class="pa-6">
        <div class="book-addition__row mb-2">
          <div class="label-text book-addition__label">英語</div>
          <div class="flex-grow-1">
            <RedLetterEditor
              ref="textEnEditor"
              v-model="textEnModel"
              :error="enError"
              :helper-text="enError ? REQUIRED_MESSAGE : undefined"
            />
          </div>
        </div>

        <div class="mb-2 book-addition__wrap">
          <Hint v-slot="{ props }" label="選択範囲を赤文字にする(再押下で解除)">
            <!-- mousedown で選択範囲が外れないようにする -->
            <v-btn
              v-bind="props"
              icon="mdi-format-color-text"
              variant="text"
              color="red-darken-3"
              aria-label="選択範囲を赤文字にする"
              @mousedown.prevent
              @click="onWrapSelection"
            />
          </Hint>
        </div>

        <div class="book-addition__row mb-3">
          <div class="label-text book-addition__label">日本語</div>
          <div class="flex-grow-1">
            <RedLetterEditor
              ref="textJpEditor"
              v-model="textJpModel"
              :error="jpError"
              :helper-text="jpError ? REQUIRED_MESSAGE : undefined"
            />
          </div>
        </div>

        <!-- 既存の節の確認状況(行の高さが変わらないよう min-height を確保) -->
        <div class="noto-serif mb-3 book-addition__status" aria-live="polite">
          <span v-if="lookup === 'loading'" class="text-medium-emphasis"
            >既存の節を確認中…</span
          >
          <span v-else-if="lookup === 'found'" class="text-red-darken-3">
            この節は登録済みです。保存すると上書き更新されます。
            <button
              v-if="differsFromExisting"
              type="button"
              class="book-addition__load ml-2"
              @click="loadExisting"
            >
              既存の内容を読み込む
            </button>
          </span>
          <span v-else-if="lookup === 'error'" class="text-red-darken-3">
            既存の節かどうか確認できませんでした。保存時に確認します。
          </span>
        </div>

        <div class="book-addition__fields">
          <div class="book-addition__field book-addition__field--book">
            <label for="book-select" class="book-addition__field-label"
              >書</label
            >
            <BookCombobox
              id="book-select"
              v-model="bookModel"
              :books="books"
              class="noto-serif"
            />
          </div>

          <div class="book-addition__field book-addition__field--chapter">
            <label for="chapter-select" class="book-addition__field-label">
              章
              <v-progress-circular
                v-if="chapterLoading"
                indeterminate
                size="12"
                width="2"
              />
            </label>
            <!-- 詩篇(150章)でも数字を打てば絞り込める(「23」→「第23章」) -->
            <BookCombobox
              id="chapter-select"
              v-model="chapterModel"
              :books="chapters"
              :loading="chapterLoading"
              placeholder="章を選択"
              no-data-text="該当する章がありません"
              class="noto-serif"
            />
          </div>

          <div class="book-addition__field book-addition__field--verse">
            <label for="verse-input" class="book-addition__field-label"
              >節</label
            >
            <v-text-field
              id="verse-input"
              v-model="verseId"
              type="text"
              placeholder="節の数を入力しましょう"
              variant="outlined"
              density="compact"
              color="primary"
              :error-messages="errors.verseId ? REQUIRED_MESSAGE : undefined"
              :hide-details="!errors.verseId"
              class="noto-serif"
            />
          </div>

          <!-- ボタンも他の列と同じ構造にする(見えないラベルで高さを揃える。縦積みの時は空きを作らない) -->
          <div class="book-addition__field book-addition__field--action">
            <span
              aria-hidden="true"
              class="book-addition__field-label book-addition__ghost"
              >追加</span
            >
            <v-btn
              block
              color="primary"
              variant="flat"
              class="noto-serif"
              :loading="saving"
              :disabled="lookup === 'loading'"
              :prepend-icon="isUpdate ? 'mdi-cross' : 'mdi-book-outline'"
              @click="onStore"
            >
              {{ isUpdate ? "更新" : "追加" }}
            </v-btn>
          </div>
        </div>
      </div>
    </div>

    <!-- 上書き確認 -->
    <v-dialog
      v-model="confirmOpen"
      max-width="512"
      role="alertdialog"
      aria-labelledby="book-overwrite-title"
    >
      <v-card class="noto-serif pa-6" rounded="lg">
        <h2 id="book-overwrite-title" class="text-title-large font-weight-bold">
          上書きの確認
        </h2>
        <p class="text-body-medium text-medium-emphasis mt-2">
          {{
            isUpdate
              ? `${verseLabel} は既に登録されています。入力した内容で上書きして更新しますか?`
              : "既存の節かどうか確認できませんでした。既に登録されている場合は上書きされます。保存しますか?"
          }}
        </p>
        <div class="d-flex justify-end ga-2 mt-6">
          <v-btn variant="outlined" @click="confirmOpen = false"
            >キャンセル</v-btn
          >
          <v-btn color="primary" variant="flat" @click="doSave">
            {{ isUpdate ? "更新する" : "保存する" }}
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.book-addition {
  position: relative;
  min-height: 100%;
}
.bookaddition-card {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
}
.book-addition__header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #1f2937;
  color: #fff;
}
.book-addition__row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.book-addition__label {
  width: 64px;
  flex-shrink: 0;
  padding-top: 8px;
  text-align: right;
  font-size: 0.95rem;
  font-weight: 600;
}
.book-addition__wrap {
  padding-left: 64px;
}
.book-addition__status {
  min-height: 24px;
  padding-left: 80px;
  font-size: 0.875rem;
}
.book-addition__load {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  text-decoration: underline;
}
.book-addition__load:hover {
  opacity: 0.8;
}
.book-addition__fields {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
}
.book-addition__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.book-addition__field-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.875rem;
  color: #4b5563;
}
.book-addition__ghost {
  visibility: hidden;
}
@media (max-width: 767px) {
  .book-addition__ghost {
    display: none;
  }
}
@media (min-width: 768px) {
  .book-addition__field--book,
  .book-addition__field--verse {
    width: 22%;
  }
  .book-addition__field--chapter {
    width: 30%;
  }
  .book-addition__field--action {
    width: 16%;
  }
}
</style>
