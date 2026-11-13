<script setup lang="ts">
// 賛美歌の追加・編集モーダル(旧 components/HymnFormModal.tsx)。
// 賛美歌一覧から v-if で開く。ルーティングやURLパラメータは使わず、一覧側の状態(pageSize 等)を props で受け取る。
// Esc・背景クリック・「閉じる」のどれで閉じようとしても close() を通り、入力中の内容があれば確認する。
import { computed, reactive, ref, watch } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { storeToRefs } from "pinia";
import api from "@/api/axios";
import { fetchHymnDetail, hymnKeys, invalidateHymns } from "@/api/hymns";
import { invalidateLyric } from "@/lib/lyrics";
import { useFeedbackStore } from "@/stores/feedback";
import { useAuthStore } from "@/stores/auth";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { EMPTY_STRING, extractErrorMessage } from "@/lib/constants";
import { required } from "@/lib/form";

const props = defineProps<{
  mode: "add" | "edit";
  /** 編集時の曲ID(Snowflake の19桁なので文字列で受け取る) */
  editId?: string;
  /** 追加API(POST /hymns?pageSize=)へ渡す一覧の1ページ件数 */
  pageSize: number;
}>();
const emit = defineEmits<{
  close: [];
  /** 保存成功時。追加のときだけ、新しい曲が載るページ番号(X-Page-Num)が入る */
  saved: [result: { mode: "add" | "edit"; pageNum?: number }];
}>();

type FormState = {
  id: string | null;
  nameJp: string;
  nameKr: string;
  link: string;
  lyric: string;
  classic: boolean;
  updatedTime: string;
  updatedUser: string;
};
const EDITABLE = ["nameJp", "nameKr", "link", "lyric", "classic"] as const;
type Editable = Pick<FormState, (typeof EDITABLE)[number]>;

const emptyForm: FormState = {
  id: null,
  nameJp: EMPTY_STRING,
  nameKr: EMPTY_STRING,
  link: EMPTY_STRING,
  lyric: EMPTY_STRING,
  classic: false,
  updatedTime: EMPTY_STRING,
  updatedUser: EMPTY_STRING,
};

const feedback = useFeedbackStore();
const queryClient = useQueryClient();
const { userId } = storeToRefs(useAuthStore());

const isEdit = computed(() => props.mode === "edit");
const editId = computed(() => (isEdit.value ? (props.editId ?? null) : null));
const color = computed(() => (isEdit.value ? "primary" : "success"));

// 編集時: 既存データを読み込む。応答が届く前にモーダルを閉じても(別の曲を開いても)、
// クエリはこの曲のキーにひも付いているので、古い応答が別の曲のフォームに入ることはない。
// 他の人の更新を拾えるよう、開くたびに取り直す(staleTime: 0)。
// ただし編集中には取り直さない。途中で取り直すと updatedTime(楽観ロック)が新しくなり、
// 他の人の更新を上書きしても保存が通ってしまうため。
const detailQuery = useQuery(
  computed(() => ({
    queryKey: hymnKeys.detail(editId.value ?? ""),
    queryFn: () => fetchHymnDetail(editId.value!),
    enabled: isEdit.value && !!editId.value,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })),
);

// 読み込めないまま空のフォームで更新できてしまわないよう、モーダルを閉じる
watch(detailQuery.error, (err) => {
  if (!err) return;
  feedback.toast(extractErrorMessage(err, "データの取得に失敗しました"));
  emit("close");
});

// 編集の基準(追加は空、編集は読み込んだ内容。読み込み前は null)
const originalForm = computed<FormState | null>(() => {
  if (!isEdit.value) return { ...emptyForm };
  const data = detailQuery.data.value;
  return data ? { ...emptyForm, ...data, id: editId.value } : null;
});

// ユーザーが入力した分だけを持ち、画面に出す値は「基準 + 入力」で作る
// (読み込みが入力より後に届いても、入力した内容は消えない)
const edits = reactive<Partial<Editable>>({});
const form = computed<FormState>(() => ({
  ...(originalForm.value ?? { ...emptyForm, id: editId.value }),
  ...edits,
}));
/** 入力欄の v-model 用。触った項目だけ edits に入る */
const field = <K extends keyof Editable>(key: K) =>
  computed<Editable[K]>({
    get: () => form.value[key],
    set: (v) => {
      edits[key] = v;
    },
  });
const nameJp = field("nameJp");
const nameKr = field("nameKr");
const link = field("link");
const lyric = field("lyric");
const classic = field("classic");

const emptyErrors = () => ({
  nameJp: EMPTY_STRING,
  nameKr: EMPTY_STRING,
  link: EMPTY_STRING,
  lyric: EMPTY_STRING,
});
const errors = reactive(emptyErrors());

const checkDuplicate = async (
  key: "nameJp" | "nameKr",
  url: string,
  name: string,
) => {
  errors[key] = EMPTY_STRING;
  if (!name) return;
  try {
    await api.get(url, {
      params: { id: form.value.id ?? EMPTY_STRING, [key]: name },
    });
  } catch (e) {
    errors[key] = extractErrorMessage(e, "この名称は既に使われています。");
  }
};
const checkNameJp = () =>
  checkDuplicate(
    "nameJp",
    "/hymns/duplicate-check-jp",
    form.value.nameJp.trim(),
  );
const checkNameKr = () =>
  checkDuplicate(
    "nameKr",
    "/hymns/duplicate-check-kr",
    form.value.nameKr.trim().normalize("NFC"),
  );

const saveMutation = useMutation({
  mutationFn: async (f: FormState) => {
    const payload = {
      nameJp: f.nameJp.trim(),
      nameKr: f.nameKr.trim().normalize("NFC"),
      link: f.link,
      lyric: f.lyric,
      classic: f.classic,
      updatedUser: userId.value,
    };
    if (isEdit.value) {
      const { data } = await api.put(`/hymns/${f.id}`, {
        ...payload,
        id: f.id,
        updatedTime: f.updatedTime,
      });
      return { mode: "edit" as const, message: data as unknown };
    }
    const { headers } = await api.post("/hymns", payload, {
      params: { pageSize: props.pageSize || 5 },
    });
    // axios はヘッダー名を小文字化して格納する
    return {
      mode: "add" as const,
      pageNum: Number(headers["x-page-num"]) || 1,
    };
  },
  onSuccess: (result, f) => {
    // 一覧・ホーム・画面検索の索引・この曲の編集用データのキャッシュを捨てる
    void invalidateHymns(queryClient);
    if (result.mode === "edit") {
      // ホーム画面の歌詞キャッシュ(5分)に古い歌詞が残らないよう、この曲の分を捨てる
      if (f.id) void invalidateLyric(queryClient, f.id);
      feedback.toast(
        typeof result.message === "string" ? result.message : "更新しました",
      );
      emit("saved", { mode: "edit" });
    } else {
      feedback.toast("追加済み");
      emit("saved", { mode: "add", pageNum: result.pageNum });
    }
  },
  onError: (e) => feedback.toast(extractErrorMessage(e, "保存に失敗しました")),
});
const saving = saveMutation.isPending;

const onSubmit = () => {
  const f = form.value;
  Object.assign(errors, {
    nameJp: required(f.nameJp) || errors.nameJp,
    nameKr: required(f.nameKr) || errors.nameKr,
    link: required(f.link),
    lyric: required(f.lyric),
  });
  if (Object.values(errors).some(Boolean)) {
    feedback.toast("入力情報不正");
    return;
  }
  if (!userId.value) {
    feedback.toast(
      "ログイン情報の取得に失敗しました。再度ログインしてください。",
    );
    return;
  }
  saveMutation.mutate(f);
};

const onReset = () => {
  // 入力を捨てると、基準(追加は空、編集は読み込んだ内容)に戻る
  for (const k of EDITABLE) delete edits[k];
  Object.assign(errors, emptyErrors());
};

// 編集内容があるか。追加は空の状態、編集は読み込んだ内容(originalForm)と比べる。
// 編集で読み込みがまだ終わっていないときは、変更なし扱い。
const isDirty = computed(() => {
  const base = originalForm.value;
  return !!base && EDITABLE.some((k) => form.value[k] !== base[k]);
});

// 編集内容があるまま、タブを閉じる・再読み込み・別サイトへ移動しようとしたらブラウザが確認する
useUnsavedChanges(isDirty);

// 編集内容を捨てて閉じてよいかの確認ダイアログ
const discardOpen = ref(false);

const close = () => {
  if (saving.value) return; // 保存中は誤って閉じられないようにする
  if (isDirty.value) {
    discardOpen.value = true;
    return;
  }
  emit("close");
};

const discard = () => {
  discardOpen.value = false;
  emit("close");
};
</script>

<template>
  <!-- Vuetify の一般的なフォームダイアログの形: タイトル / 入力欄 / 下のボタン(右寄せ) -->
  <v-dialog
    :model-value="true"
    max-width="640"
    scrollable
    aria-labelledby="hymn-form-title"
    @update:model-value="(v) => !v && close()"
  >
    <v-card
      class="noto-sans"
      :prepend-icon="isEdit ? 'mdi-notebook-edit-outline' : 'mdi-plus-circle-outline'"
    >
      <template #title>
        <span id="hymn-form-title">
          {{ isEdit ? "賛美歌情報更新" : "賛美歌情報追加" }}
        </span>
      </template>

      <v-divider />

      <v-card-text>
        <v-row density="compact">
          <v-col cols="12" sm="6">
            <v-text-field
              id="hymn-name-jp"
              v-model="nameJp"
              label="日本語名称"
              :disabled="saving"
              :error-messages="errors.nameJp || undefined"
              :color="color"
              @blur="checkNameJp"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              id="hymn-name-kr"
              v-model="nameKr"
              label="韓国語名称"
              :disabled="saving"
              :error-messages="errors.nameKr || undefined"
              :color="color"
              @blur="checkNameKr"
            />
          </v-col>
          <v-col cols="12">
            <v-text-field
              id="hymn-link"
              v-model="link"
              label="リンク"
              :disabled="saving"
              :error-messages="errors.link || undefined"
              :color="color"
            />
          </v-col>
          <v-col cols="12">
            <v-switch
              id="hymn-classic"
              v-model="classic"
              label="クラシック"
              :disabled="saving"
              :color="color"
              inset
              hide-details
            />
          </v-col>
          <v-col cols="12">
            <v-textarea
              id="hymn-lyric"
              v-model="lyric"
              label="歌詞"
              rows="8"
              no-resize
              :disabled="saving"
              :error-messages="errors.lyric || undefined"
              :color="color"
            />
          </v-col>
        </v-row>
        <!-- 追加と更新でタイトル部分の高さを同じにするため、最終更新者はタイトルではなく入力欄の下に出す -->
        <p v-if="isEdit" class="text-body-small text-medium-emphasis">
          最終更新者：{{ form.updatedUser }}＠{{ form.updatedTime }}日本標準時間
        </p>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-btn variant="plain" :disabled="saving" @click="onReset">
          {{ isEdit ? "廃棄" : "リセット" }}
        </v-btn>
        <v-spacer />
        <v-btn variant="plain" :disabled="saving" @click="close">閉じる</v-btn>
        <v-btn
          :color="color"
          variant="tonal"
          :loading="saving"
          @click="onSubmit"
        >
          {{ isEdit ? "更新" : "追加" }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- 編集内容の破棄確認 -->
    <v-dialog
      v-model="discardOpen"
      max-width="400"
      aria-labelledby="hymn-discard-title"
    >
      <v-card class="noto-sans">
        <template #title>
          <span id="hymn-discard-title">編集内容があります</span>
        </template>
        <v-card-text>
          {{
            isEdit
              ? "変更を破棄して閉じますか?"
              : "入力した内容を破棄して閉じますか?"
          }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="plain" @click="discardOpen = false">
            編集を続ける
          </v-btn>
          <v-btn :color="color" variant="tonal" @click="discard">
            破棄して閉じる
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>
