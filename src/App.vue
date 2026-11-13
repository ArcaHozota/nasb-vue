<script setup lang="ts">
// アプリのルート(旧 app/layout.tsx + providers.tsx + error.tsx)。
//  - FeedbackHost(トースト・確認ダイアログ)をグローバルに1つだけ置く
//  - 最初の画面遷移(ログイン確認を含む)が終わるまでは読み込み表示を出す
//  - 描画中の想定外のエラーを受け止め、エラー画面を出す(旧 error.tsx)
import { onErrorCaptured, ref } from "vue";
import { useRouter } from "vue-router";
import FeedbackHost from "@/components/FeedbackHost.vue";

const router = useRouter();
const ready = ref(false);
void router.isReady().finally(() => {
  ready.value = true;
});

const renderError = ref<unknown>(null);
onErrorCaptured((err) => {
  console.error(err);
  renderError.value = err;
  return false; // 上へは伝えない(ここで画面を差し替える)
});
// 画面の遅延読み込みの失敗(デプロイ直後の古いチャンクなど)もエラー画面にする
router.onError((err) => {
  console.error(err);
  renderError.value = err;
});

const reload = () => window.location.reload();
</script>

<template>
  <v-app>
    <main v-if="renderError" class="app-error pa-8 text-center">
      <h1 class="text-title-large font-weight-bold">エラーが発生しました</h1>
      <p class="text-body-medium text-medium-emphasis">
        時間をおいてもう一度お試しください。解消しない場合はホームへ戻ってください。
      </p>
      <div class="d-flex justify-center ga-2">
        <v-btn color="primary" variant="flat" @click="reload">再読み込み</v-btn>
        <v-btn variant="outlined" href="/home">ホームへ</v-btn>
      </div>
    </main>
    <router-view v-else-if="ready" />
    <div
      v-else
      class="app-loading"
      role="status"
      aria-label="読み込み中"
    >
      <v-progress-circular indeterminate size="24" width="2" />
    </div>
    <FeedbackHost />
  </v-app>
</template>

<style scoped>
.app-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  max-width: 448px;
  min-height: 100dvh;
  margin: 0 auto;
}
.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100dvh;
}
</style>
