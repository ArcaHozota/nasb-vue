<script setup lang="ts">
// src/views/ErrorPage.vue
// 旧 views/ErrorPage.tsx を移植
import { computed } from "vue";
import { useRoute } from "vue-router";
import { base64ToUtf8 } from "@/constants";

const route = useRoute();

const message = computed(() => {
  const encoded = route.query.errMsg;
  if (typeof encoded !== "string") return "不明なエラーが発生しました";
  try {
    return base64ToUtf8(decodeURIComponent(encoded));
  } catch {
    return "不明なエラーが発生しました";
  }
});
</script>

<template>
  <div class="p-8 text-center">
    <h1 class="mb-4 text-xl font-semibold text-red-600">
      エラーが発生しました
    </h1>
    <p>{{ message }}</p>
  </div>
</template>
