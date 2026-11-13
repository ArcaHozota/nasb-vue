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

const color = computed(() =>
  dialog.value.variant === "success" ? "success" : "primary",
);
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
       外側クリックでは閉じない(persistent)。Esc はキャンセル扱い。 -->
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
          class="text-body-medium text-medium-emphasis"
        >
          {{ dialog.text }}
        </p>
        <div class="d-flex justify-end ga-2 mt-6">
          <!-- 先頭のキャンセルに初期フォーカスが当たる(誤操作で OK しないように) -->
          <v-btn
            variant="text"
            size="small"
            class="text-medium-emphasis"
            @click="feedback.answer(false)"
          >
            {{ dialog.cancelLabel }}
          </v-btn>
          <v-btn
            :color="color"
            variant="flat"
            size="small"
            @click="feedback.answer(true)"
          >
            {{ dialog.confirmLabel }}
          </v-btn>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.feedback-dialog-bar {
  height: 3px;
  border-radius: 9999px;
}
</style>
