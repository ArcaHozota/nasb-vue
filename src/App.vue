<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { useFeedbackStore } from "@/stores/feedback";

// Step2確認用の仮画面。認証済みレイアウト・ルーティングはステップ3以降で行う。
const auth = useAuthStore();
const { isLoggedIn, username } = storeToRefs(auth);

const feedback = useFeedbackStore();
const { snackbar, dialog } = storeToRefs(feedback);

const onToast = () => feedback.toast("Piniaのtoastストア、動作しています。");

const onConfirm = async () => {
  const ok = await feedback.confirm("この操作を続行しますか?", "確認");
  feedback.toast(ok ? "「はい」が選択されました" : "「いいえ」が選択されました");
};
</script>

<template>
  <main class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="max-w-md w-full rounded-lg border border-gray-200 bg-white p-8 shadow-sm space-y-4">
      <h1 class="text-2xl font-bold text-primary">NASB1995</h1>
      <p class="text-sm text-info">
        ログイン状態: {{ isLoggedIn ? `ログイン中(${username})` : "未ログイン" }}
      </p>

      <div class="flex gap-2">
        <button
          class="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white"
          @click="onToast"
        >
          toast() を試す
        </button>
        <button
          class="rounded bg-secondary px-3 py-1.5 text-sm font-medium text-white"
          @click="onConfirm"
        >
          confirm() を試す
        </button>
      </div>
    </div>

    <!-- 簡易スナックバー(FeedbackHostの本実装はステップ4以降で) -->
    <div
      v-if="snackbar.show"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 rounded bg-info px-4 py-2 text-sm text-white shadow-lg"
    >
      {{ snackbar.text }}
    </div>

    <!-- 簡易確認ダイアログ -->
    <div
      v-if="dialog.show"
      class="fixed inset-0 flex items-center justify-center bg-black/40"
    >
      <div class="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h2 class="text-lg font-semibold">{{ dialog.title }}</h2>
        <p class="mt-2 text-sm text-gray-600">{{ dialog.text }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <button
            class="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            @click="feedback.answer(false)"
          >
            いいえ
          </button>
          <button
            class="rounded bg-primary px-3 py-1.5 text-sm text-white"
            @click="feedback.answer(true)"
          >
            はい
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
