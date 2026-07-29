<script setup lang="ts">
// src/components/FeedbackHost.vue
// 旧 components/FeedbackHost.tsx をTailwindで再実装したもの。
// App.vue直下にグローバルマウントする(旧 providers.tsx の {children}<FeedbackHost/> と同じ位置づけ)。
import { storeToRefs } from "pinia";
import { useFeedbackStore } from "@/stores/feedback";

const feedback = useFeedbackStore();
const { snackbar, dialog } = storeToRefs(feedback);
</script>

<template>
  <!-- スナックバー(旧 MUI Snackbar 相当) -->
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    leave-active-class="transition duration-150 ease-in"
    leave-to-class="opacity-0"
  >
    <div
      v-if="snackbar.show"
      class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded bg-gray-800 px-4 py-2 text-sm text-white shadow-lg"
    >
      {{ snackbar.text }}
    </div>
  </Transition>

  <!-- 確認ダイアログ(旧 MUI Dialog 相当) -->
  <div
    v-if="dialog.show"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    @click.self="feedback.answer(false)"
  >
    <div class="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
      <h2 class="text-lg font-semibold text-gray-900">{{ dialog.title }}</h2>
      <p class="mt-2 text-sm text-gray-600">{{ dialog.text }}</p>
      <div class="mt-6 flex justify-end gap-2">
        <button
          class="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          @click="feedback.answer(false)"
        >
          キャンセル
        </button>
        <button
          class="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white"
          @click="feedback.answer(true)"
        >
          OK
        </button>
      </div>
    </div>
  </div>
</template>
