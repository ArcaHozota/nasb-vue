<script setup lang="ts">
// エルサレム十字のロゴ(nasb-next の components/JerusalemCross.tsx と同じ形)。
// 腕の先が T 字形の本来のエルサレム十字。PC版ホーム・モバイル版ホーム・管理画面のサイドバーで共通に使う。
// 色は文字色(currentColor)に従う(既定はテーマの primary = 臙脂)。大きさは size(px)で指定する。
// 太さを元の SVG ファイルと同じにするため、塗りに加えて同じ色の線(stroke)を重ねている。
withDefaults(defineProps<{ size?: number | string }>(), { size: 32 });
</script>

<template>
  <svg
    viewBox="0 0 512 512"
    :width="size"
    :height="size"
    fill="currentColor"
    stroke="currentColor"
    stroke-width="16.896"
    aria-hidden="true"
    class="jerusalem-cross"
  >
    <path
      d="M352 23v18h-78v197h197v-78h18v192h-18v-78H274v197h78v18H160v-18h78V274H41v78H23V160h18v78h197V41h-78V23zm41 41v55h55v18h-55v55h-18v-55h-55v-18h55V64zm-256 0v55h55v18h-55v55h-18v-55H64v-18h55V64zm256 256v55h55v18h-55v55h-18v-55h-55v-18h55v-55zm-256 0v55h55v18h-55v55h-18v-55H64v-18h55v-55z"
    />
  </svg>
</template>

<style scoped>
.jerusalem-cross {
  flex-shrink: 0;
  color: rgb(var(--v-theme-primary));
}
</style>
