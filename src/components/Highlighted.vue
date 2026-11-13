<script setup lang="ts">
// 検索した語に一致する部分を <mark> で強調して表示する(旧 components/Highlighted.tsx)
import { computed } from "vue";
import { splitByTerms } from "@/lib/lyrics";

const props = defineProps<{
  text: string;
  terms: string[];
  markClass?: string;
}>();

const parts = computed(() => splitByTerms(props.text, props.terms));
</script>

<template>
  <template v-for="(part, i) in parts" :key="i">
    <mark v-if="part.hit" :class="['lyric-mark', markClass]">{{
      part.text
    }}</mark>
    <span v-else>{{ part.text }}</span>
  </template>
</template>
