<script setup lang="ts">
// 存在しないURLに来たときの画面(旧 app/not-found.tsx)
</script>

<template>
  <v-empty-state
    class="min-vh-100"
    title="ページが見つかりません"
    text="URLが間違っているか、ページが移動または削除された可能性があります。"
  >
    <template #headline>
      <div class="text-display-medium font-weight-bold text-primary">404</div>
    </template>
    <template #actions>
      <v-btn color="primary" variant="flat" to="/home">ホームへ戻る</v-btn>
    </template>
  </v-empty-state>
</template>

<style scoped>
.min-vh-100 {
  min-height: 100dvh;
}
</style>
