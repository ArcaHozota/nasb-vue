<script setup lang="ts">
import { ref } from "vue";
import { useTheme } from "vuetify";

const theme = useTheme();
const colors = Object.keys(theme.current.value.colors).filter((k) =>
  ["primary", "secondary", "success", "warning", "info", "error"].includes(k),
);
const count = ref(0);
</script>

<template>
  <v-container class="py-10" max-width="720">
    <div class="effect-shine mb-4">NASB1995</div>
    <v-card class="pa-6" rounded="lg">
      <v-card-title class="noto-serif">Vite + Vue 3 + TS + Vuetify 4</v-card-title>
      <v-card-text class="noto-sans">
        テーマ色とフォント(Noto Sans JP / Noto Serif JP / Noto Serif KR)の確認用ページです。
        <div class="noto-serif mt-2">讃美歌 · 찬송가</div>
      </v-card-text>
      <v-card-actions class="flex-wrap ga-2 px-4">
        <v-btn v-for="c in colors" :key="c" :color="c" variant="flat" @click="count++">
          {{ c }}
        </v-btn>
      </v-card-actions>
      <v-card-text>クリック数: {{ count }}</v-card-text>
    </v-card>
  </v-container>
</template>
