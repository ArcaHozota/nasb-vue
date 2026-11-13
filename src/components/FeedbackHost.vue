<script setup lang="ts">
// src/components/FeedbackHost.vue
// App.vue 直下にグローバルマウントする(旧 components/FeedbackHost.tsx)。
// トースト → v-snackbar-queue、確認ダイアログ → v-dialog。
// フォーカストラップ・背面スクロールのロックは v-dialog 側が担当する。
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useFeedbackStore } from "@/stores/feedback";

const feedback = useFeedbackStore();
const { dialog, toasts } = storeToRefs(feedback);

// 色はテーマ色の名前そのまま(primary / success / secondary)
const color = computed(() => dialog.value.variant);
</script>

<template>
  <!-- スナックバー(旧 Sonner / MUI Snackbar 相当): 画面下中央・濃いグレー -->
  <v-snackbar-queue
    v-model="toasts"
    location="bottom center"
    color="grey-darken-4"
    rounded="sm"
  />

  <!-- 確認ダイアログ(旧 AlertDialog 相当)。
       外側クリックでは閉じない(persistent)。Esc は「戻る」と同じく false を返す(onCancel は呼ばない)。 -->
  <v-dialog
    :model-value="dialog.show"
    persistent
    max-width="384"
    role="alertdialog"
    aria-labelledby="feedback-dialog-title"
    aria-describedby="feedback-dialog-text"
  >
    <v-card
      class="noto-sans"
      rounded="lg"
      @keydown.esc.stop="feedback.answer(false)"
    >
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
      <div class="pa-6">
        <p
          id="feedback-dialog-text"
          class="feedback-dialog-text text-medium-emphasis text-center"
        >
          {{ dialog.text }}
        </p>
        <div class="feedback-dialog-actions d-flex justify-end ga-2 mt-6">
          <!-- 先頭の「戻る」に初期フォーカスが当たる(誤操作で OK しないように) -->
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
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* 本文: 1.156rem(太さは既定のまま) */
.feedback-dialog-text {
  font-size: 1.156rem;
  line-height: 1.6;
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
