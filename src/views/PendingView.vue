<script setup lang="ts">
// まだ移植していない画面の仮置き(フェーズ5で各画面に差し替えて削除する)
import { useRoute } from "vue-router";

const route = useRoute();
</script>

<template>
  <v-empty-state
    icon="mdi-hammer-wrench"
    :title="route.meta.title ?? route.path"
    text="この画面はまだ移植していません(フェーズ5で移植予定)。"
  >
    <template #actions>
      <v-btn variant="outlined" to="/home">ホームへ</v-btn>
    </template>
  </v-empty-state>
</template>
