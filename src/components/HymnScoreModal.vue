<script setup lang="ts">
// 楽譜のアップロード(旧 components/HymnScoreModal.tsx)。賛美歌一覧から v-if で表示するモーダル。
// Esc・背景クリック・×のどれで閉じようとしても close() を通る(アップロード中は閉じない)。
import { ref } from "vue";
import axios from "axios";
import api from "@/api/axios";
import { useFeedbackStore } from "@/stores/feedback";
import { EMPTY_STRING, extractErrorMessage } from "@/lib/constants";
import { downloadScore } from "@/lib/download";

const props = defineProps<{
  hymnId: string;
  hymnNameKr: string;
}>();
const emit = defineEmits<{ close: []; uploaded: [] }>();

/** バックエンドの上限(現行 struts.multipart.maxSize と同じ 30MB) */
const MAX_FILE_BYTES = 30 * 1024 * 1024;

/**
 * 12長調(半音ずつ上がる順。上の段 A〜E♭、下の段 E〜A♭)。
 * value は DB(HYMNS_WORK.CHORD)に保存する値(ASCII)、label は画面表示。
 * value はバックエンド(HymnsHandler)の許可リストと同じ値にすること。
 */
const MAJOR_KEYS = [
  { value: "A", label: "A" },
  { value: "Bb", label: "B♭" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
  { value: "Db", label: "D♭" },
  { value: "D", label: "D" },
  { value: "Eb", label: "E♭" },
  { value: "E", label: "E" },
  { value: "F", label: "F" },
  { value: "Gb", label: "G♭" },
  { value: "G", label: "G" },
  { value: "Ab", label: "A♭" },
] as const;

/** 調チップの1段目の個数(7個＋5個の2段にする) */
const KEYS_PER_ROW = 7;

const feedback = useFeedbackStore();
const fileInput = ref<HTMLInputElement | null>(null);

const file = ref<File | null>(null);
const chord = ref<string>(EMPTY_STRING);
const isOriginal = ref(false);
const error = ref(EMPTY_STRING);
const uploading = ref(false);

const close = () => {
  if (uploading.value) return; // アップロード中は誤って閉じられないようにする
  emit("close");
};

const onChord = (v: string | undefined) => {
  // 選択済みを再クリックすると v が空になるので、選択を維持する
  // (mandatory は最初の調を勝手に選んでしまうので使わない)
  if (!v) return;
  chord.value = v;
  error.value = EMPTY_STRING;
};

const onFilePick = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const picked = input.files?.[0] ?? null;
  // 同じファイルをもう一度選んでも change が起きるよう、選択を空に戻しておく
  input.value = "";
  if (picked && picked.size > MAX_FILE_BYTES) {
    // 上限を超えるファイルは、送信を待たずにここで知らせる
    file.value = null;
    error.value = "ファイルが大きすぎます(30MBまで)。";
    return;
  }
  file.value = picked;
  error.value = EMPTY_STRING;
};

// overwrite=false: 同じ調に違う内容の楽譜があればサーバーが 409 を返す(上書きしない)
// overwrite=true : 上書き確認で「OK」を選んだあとの再送
const doUpload = async (overwrite: boolean) => {
  if (!file.value) return;
  const formData = new FormData();
  formData.append("score", file.value);
  formData.append("chord", chord.value);
  formData.append("isOriginal", String(isOriginal.value));
  formData.append("overwrite", String(overwrite));
  uploading.value = true;
  let conflict = false;
  try {
    const { data } = await api.post(`/hymns/${props.hymnId}/score`, formData, {
      timeout: 66_000,
    });
    feedback.toast(typeof data === "string" ? data : "アップロードしました");
    emit("uploaded");
    emit("close");
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && e.response?.status === 409) {
      // この調の楽譜は登録済み: ファイル・調・オリジナルの入力はそのまま残して、下で確認する
      conflict = true;
    } else {
      feedback.toast(extractErrorMessage(e, "通信エラーが発生しました。"));
    }
  } finally {
    uploading.value = false;
  }
  if (conflict) await confirmOverwrite();
};

// 上書き確認(アプリ共通の確認ダイアログ。タイトル「通知」・青)。
//   OK  : 上書きして再送する
//   戻る: 上書きせず、登録済みの楽譜をダウンロードして中身を確かめる(このモーダルは開いたまま)
//   Esc : 何もしない
const confirmOverwrite = async () => {
  const ok = await feedback.confirm(
    `${chordText()}の楽譜は登録済みです。上書きしますか？`,
    "通知",
    { variant: "secondary", onCancel: downloadExisting },
  );
  if (ok) await doUpload(true);
};

const onUpload = async () => {
  if (!chord.value) {
    error.value = "調を選択してください。";
    return;
  }
  if (!file.value) {
    error.value = "ファイルを選択してください。";
    return;
  }
  await doUpload(false);
};

// 登録済みの楽譜をダウンロードして中身を確認する
const downloadExisting = async () => {
  try {
    await downloadScore(props.hymnId, chord.value);
  } catch (e: unknown) {
    feedback.toast(e instanceof Error ? e.message : "楽譜の取得に失敗しました");
  }
};

const chordText = () =>
  MAJOR_KEYS.find((k) => k.value === chord.value)?.label ?? chord.value;
</script>

<template>
  <v-dialog
    :model-value="true"
    max-width="448"
    aria-labelledby="score-modal-title"
    aria-describedby="score-modal-desc"
    @update:model-value="(v) => !v && close()"
  >
    <v-card class="score-modal noto-sans" rounded="xl">
      <div class="pt-3">
        <!-- タイトルは中央、閉じるボタンは右上に固定する -->
        <div class="score-modal__head">
          <h2
            id="score-modal-title"
            class="text-center text-title-medium font-weight-bold text-secondary"
          >
            楽譜-{{ hymnNameKr }}
          </h2>
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            color="secondary"
            class="score-modal__close"
            :disabled="uploading"
            aria-label="閉じる"
            @click="close"
          />
        </div>
        <div class="score-modal__bar mx-2 mt-2 bg-secondary" />
        <p id="score-modal-desc" class="sr-only">
          楽譜ファイル(PDF・画像)を選択してアップロードします。
        </p>
      </div>

      <div class="d-flex flex-column align-center ga-2 pa-6">
        <input
          ref="fileInput"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.gif"
          hidden
          @change="onFilePick"
        />
        <!-- 調の選択: Vuetify の filter chip(選んだ調にチェックが付く) -->
        <v-chip-group
          :model-value="chord || undefined"
          :disabled="uploading"
          color="secondary"
          column
          class="score-modal__keys justify-center mb-5"
          aria-label="調(長調)"
          @update:model-value="onChord"
        >
          <template v-for="(k, i) in MAJOR_KEYS" :key="k.value">
            <v-chip
              :value="k.value"
              :aria-label="k.label"
              variant="outlined"
              filter
            >
              {{ k.label }}
            </v-chip>
            <!-- 7個目のあとで必ず改行する(選ぶとチェックの分だけ幅が広がり、1段に入る数が変わるため) -->
            <div v-if="i === KEYS_PER_ROW - 1" class="score-modal__break" />
          </template>
        </v-chip-group>
        <div class="d-flex align-end justify-center ga-5">
          <v-btn
            variant="outlined"
            color="secondary"
            size="large"
            prepend-icon="mdi-cloud-upload-outline"
            :disabled="uploading"
            @click="fileInput?.click()"
          >
            ファイルを選択
          </v-btn>
          <div class="d-flex flex-column align-center mx-3">
            <label for="score-original" class="text-body-small text-secondary"
              >オリジナル</label
            >
            <v-switch
              id="score-original"
              v-model="isOriginal"
              :disabled="uploading"
              color="secondary"
              inset
              hide-details
              density="compact"
            />
          </div>
        </div>
        <p v-if="file" class="mt-2 text-body-medium text-medium-emphasis">
          {{ file.name }}({{ Math.round(file.size / 1024) }} KB)
        </p>
        <p v-if="error" class="mt-1 text-body-medium text-error">{{ error }}</p>
      </div>

      <div class="d-flex justify-end px-6 pb-4">
        <v-btn
          color="secondary"
          variant="flat"
          :loading="uploading"
          @click="onUpload"
        >
          アップロード
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.score-modal {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 33vh;
}
.score-modal__head {
  position: relative;
  /* 右上の閉じるボタンと重ならないよう、左右に同じ幅の余白を取って中央寄せ */
  padding: 0 44px;
}
.score-modal__close {
  position: absolute;
  top: -8px;
  right: 4px;
}
.score-modal__bar {
  height: 3px;
  border-radius: 9999px;
}
/* チップを中央に寄せて折り返す */
.score-modal__keys :deep(.v-slide-group__content) {
  justify-content: center;
}
.score-modal__break {
  flex-basis: 100%;
  height: 0;
}
</style>
