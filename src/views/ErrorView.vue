<script setup lang="ts">
// 業務エラーの表示画面(旧 (admin)/error/page.tsx)。
// /error?errMsg=<base64(UTF-8) を encodeURIComponent したもの>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { base64ToUtf8 } from "@/lib/constants";

const UNKNOWN = "不明なエラーが発生しました";
const route = useRoute();

const message = computed(() => {
  const encoded = route.query.errMsg;
  if (typeof encoded !== "string") return UNKNOWN;
  try {
    return base64ToUtf8(decodeURIComponent(encoded));
  } catch {
    return UNKNOWN;
  }
});
</script>

<template>
  <div class="error-page pa-8">
    <v-alert
      type="error"
      variant="outlined"
      icon="mdi-alert-circle-outline"
      title="エラーが発生しました"
      :text="message"
      bg-color="white"
    />
    <div class="d-flex justify-end mt-4">
      <v-btn variant="outlined" to="/mainmenu">メインメニューへ戻る</v-btn>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  max-width: 576px;
  margin: 0 auto;
}
</style>
