<script setup lang="ts">
// src/components/PageBackground.vue
// 画面全体の背景画像(画面に固定、コンテンツの背面)。各画面で共通に使う。
defineProps<{ src: string }>();
</script>

<template>
  <div class="page-background" aria-hidden="true">
    <img :src="src" alt="" />
  </div>
</template>

<style scoped>
.page-background {
  position: fixed;
  inset: 0;
  z-index: -1;
}
.page-background img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
