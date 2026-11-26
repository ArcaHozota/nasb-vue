<script setup lang="ts">
// src/components/FeedbackHost.vue
// App.vue 直下にグローバルマウントする(旧 components/FeedbackHost.tsx)。
// トースト → v-snackbar-queue、確認ダイアログ → v-dialog。
// フォーカストラップ・背面スクロールのロックは v-dialog 側が担当する。
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { useFeedbackStore } from "@/stores/feedback";

const feedback = useFeedbackStore();
const { dialog, toasts } = storeToRefs(feedback);

// トースト・ダイアログの明朝体は、最初のトースト・ダイアログを出すときに読み込む(どの画面でも同じ書体で出す)
let feedbackFontLoaded = false;
watch(
  () => toasts.value.length > 0 || dialog.value.show,
  (shown) => {
    if (!shown || feedbackFontLoaded) return;
    feedbackFontLoaded = true;
    void import("@/plugins/fonts/feedback");
  },
  { immediate: true },
);

// 色はテーマ色の名前そのまま(primary / success / secondary)。アイコンもタイトル・線と同じ色にする
const color = computed(() => dialog.value.variant);
// アイコン: 警告(primary)は「!」、お知らせ(success)・通知(secondary)は「?」
const icon = computed(() =>
  dialog.value.variant === "primary"
    ? "mdi-alert-circle-outline"
    : "mdi-help-circle-outline",
);
// 本文の文字の大きさは、文の長さで決める(本文の欄はダイアログの幅の62%と狭いので、長い文ほど小さくする)
// ダイアログの大きさ(363×225px)とアイコン(36px)は固定し、変わるのは本文の文字の大きさだけ。
// 本文の欄(幅はダイアログの62%、高さは見出しとフッターを除いた残り)に収まる大きさを、文字数で選ぶ
const textSize = computed(() => {
  const n = [...dialog.value.text].length;
  if (n <= 20) return "1.156rem";
  if (n <= 30) return "1.0625rem";
  if (n <= 44) return "0.9375rem";
  if (n <= 52) return "0.8125rem";
  return "0.75rem";
});

// Esc は「戻る」と同じく false を返す(onCancel は呼ばない)。
// 開いた直後のフォーカスはカードの外側の枠(v-overlay__content)にあり、カードやダイアログに付けた
// keydown では受け取れないため、確認ダイアログを出している間だけ画面全体で受け取る。
const onKeydown = (e: KeyboardEvent) => {
  if (e.key !== "Escape" || !dialog.value.show) return;
  e.stopPropagation();
  feedback.answer(false);
};
onMounted(() => window.addEventListener("keydown", onKeydown, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown, true));
</script>

<template>
  <!-- スナックバー(旧 Sonner / MUI Snackbar 相当): 画面下中央。背景はテーマの info、
       文字は白の Noto Serif JP 太字で中央揃え(.app-toast は v-snackbar__wrapper に付く。トーストは body 直下に出るのでスコープなしで指定) -->
  <v-snackbar-queue
    v-model="toasts"
    location="bottom center"
    color="info"
    rounded="sm"
    content-class="app-toast"
  />

  <!-- 確認ダイアログ(旧 AlertDialog 相当)。
       外側クリックでは閉じない(persistent)。Esc は onKeydown で受け取る -->
  <v-dialog
    :model-value="dialog.show"
    persistent
    width="363"
    role="alertdialog"
    aria-labelledby="feedback-dialog-title"
    aria-describedby="feedback-dialog-text"
  >
    <!-- タイトル・ボタンは全体の書体(Noto Sans JP)のまま。本文だけ Noto Serif JP(.feedback-dialog-text) -->
    <!-- 大きさは幅363px・高さ225pxで固定(本文の長さで変わらない) -->
    <v-card color="surface" rounded="lg" height="225" class="d-flex flex-column">
      <div class="pt-3">
        <div
          id="feedback-dialog-title"
          :class="[
            'text-center text-title-medium font-weight-bold',
            `text-${color}`,
          ]"
        >
          {{ dialog.title }}
        </div>
        <div :class="['feedback-dialog-bar mx-2 mt-2', `bg-${color}`]" />
      </div>
      <!-- 左右の余白は0にして、62% がダイアログの幅に対する割合になるようにする -->
      <!-- 本文の欄は、見出しとフッターを除いた残りの高さいっぱいに広げ、上下の中央に置く -->
      <v-card-text class="px-0 py-3 feedback-dialog-main">
        <!-- アイコンと本文: 合わせてダイアログの幅の62%、中央に置く -->
        <div class="feedback-dialog-body">
          <v-icon
            :icon="icon"
            :data-icon="icon"
            :color="color"
            size="36"
            class="feedback-dialog-icon"
            aria-hidden="true"
          />
          <p
            id="feedback-dialog-text"
            class="feedback-dialog-text text-medium-emphasis"
            :style="{ fontSize: textSize }"
          >
            {{ dialog.text }}
          </p>
        </div>
      </v-card-text>
      <!-- フッター: 区切り線の下に「戻る」「OK」を右寄せで置く(Vuetify の v-card-actions) -->
      <v-divider />
      <v-card-actions class="feedback-dialog-actions">
        <v-spacer />
        <v-btn
          variant="text"
          class="text-medium-emphasis"
          @click="feedback.cancel()"
        >
          {{ dialog.cancelLabel }}
        </v-btn>
        <v-btn :color="color" variant="flat" @click="feedback.answer(true)">
          {{ dialog.confirmLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.feedback-dialog-main {
  display: flex;
  flex: 1;
  align-items: center;
  min-height: 0;
  /* 想定より長い文でも、ダイアログの大きさは変えずに本文の欄の中で読めるようにする */
  overflow-y: auto;
}
/* アイコンと本文の欄: ダイアログの幅の62%。アイコンは本文の上下中央にそろえる */
.feedback-dialog-body {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 62%;
  margin: 0 auto;
}
.feedback-dialog-icon {
  flex-shrink: 0;
}
/* 本文: Noto Serif JP の semi-bold(600)。大きさは文の長さで決める(textSize) */
.feedback-dialog-text {
  font-family: "Noto Serif JP", serif;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
/* フッター: 左右と上下に余白を取り、ボタンの間は 8px */
.feedback-dialog-actions {
  gap: 8px;
  padding: 12px 16px;
}
/* ボタン: 文字の大きさは v-btn の既定のまま、太さだけ 600 */
.feedback-dialog-actions .v-btn {
  font-weight: 600;
}
.feedback-dialog-bar {
  height: 3px;
  border-radius: 9999px;
}
</style>

<style>
/* トースト: 白の Noto Serif JP 太字、文字は中央揃え */
.app-toast .v-snackbar__content {
  color: #fff;
  font-family: "Noto Serif JP", serif;
  font-weight: 700;
  text-align: center;
}
</style>
