<script setup lang="ts">
// ホームの曲の一覧の1行(PC版・モバイル版で共通)。Vuetify の v-list-item(押すと波紋)。
//   検索中   : 左に一致度の丸、右に一致度の文言(よく一致 / 一致 / やや一致 / 関連)
//   検索なし : 左に通し番号
// 行の高さは 64px(PC版は10行で一覧の高さにぴったり収まる)。
import type { HymnSummary } from "@/api/hymns";
import { matchOf } from "./match";

defineProps<{
  hymn: HymnSummary;
  /** 通し番号(検索していないときに左に出す) */
  no: string;
  searching: boolean;
  active?: boolean;
}>();
</script>

<template>
  <v-list-item
    data-hymn-row
    :active="active"
    :aria-current="active ? 'true' : undefined"
    class="hymn-row"
  >
    <template #prepend>
      <span
        v-if="searching"
        class="hymn-row__dot"
        :style="{ background: matchOf(hymn.lineNumber).dot }"
        aria-hidden="true"
      />
      <span v-else class="hymn-row__no">{{ no }}</span>
    </template>
    <v-list-item-title class="hymn-row__jp">{{
      hymn.nameJp
    }}</v-list-item-title>
    <v-list-item-subtitle class="hymn-row__kr">{{
      hymn.nameKr
    }}</v-list-item-subtitle>
    <template v-if="searching" #append>
      <span :class="['hymn-row__match', matchOf(hymn.lineNumber).tone]">{{
        matchOf(hymn.lineNumber).label
      }}</span>
    </template>
  </v-list-item>
</template>

<style scoped>
.hymn-row {
  height: 64px;
  min-height: 0 !important;
  padding-block: 0 !important;
  box-sizing: border-box;
  padding-inline: var(--hymn-row-inset, 24px) !important;
  border-bottom: 1px solid #efe8da;
}
.hymn-row :deep(.v-list-item__prepend) {
  width: 32px;
}
/* 選んだ行は薄いクリーム色(Vuetify の選択色の重ねは消す) */
.hymn-row.v-list-item--active {
  background: #fbf0d6;
}
.hymn-row.v-list-item--active :deep(.v-list-item__overlay) {
  opacity: 0;
}
.hymn-row__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.hymn-row__no {
  font-size: 0.875rem;
  font-weight: 700;
  color: #800020;
}
.hymn-row__jp {
  font-family: "Noto Serif JP", serif;
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.5;
}
.hymn-row__kr {
  font-family: "Noto Serif KR", serif;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: #6b5d4a;
  opacity: 1;
}
.hymn-row__match {
  padding-left: 12px;
  font-size: 0.8125rem;
  font-weight: 600;
}
.tone-cadmium {
  color: #14653a;
}
.tone-burgundy {
  color: #800020;
}
.tone-naples {
  color: #8a6400;
}
.tone-related {
  color: #6b6b73;
}
</style>
