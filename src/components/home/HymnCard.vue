<script setup lang="ts">
// モバイルのカルーセルの賛美歌カード(旧 app/home/page.tsx の HymnCard / SkeletonCard)。
// 見た目(ガラス・色)は app.css の .glass-card が持つ。
// item を渡さないとスケルトン(読み込み中)カードになる。
import type { HymnSummary } from "@/api/hymns";

defineProps<{ item?: HymnSummary }>();
const emit = defineEmits<{ score: [id: string]; lyric: [item: HymnSummary] }>();

const LINE_CLASS: Record<string, string> = {
  BURGUNDY: "is-burgundy",
  NAPLES: "is-naples",
  CADMIUM: "is-cadmium",
};
</script>

<template>
  <article
    v-if="item"
    role="article"
    :class="['glass-card is-slide hymn-card', LINE_CLASS[item.lineNumber], `glow-${item.lineNumber}`]"
  >
    <a :href="item.link" target="_blank" rel="noopener noreferrer" class="noto-serif hymn-card__title">
      {{ item.nameJp }} / {{ item.nameKr }}
    </a>
    <div class="hymn-card__actions">
      <button type="button" class="hymn-card__btn" aria-label="歌詞" @click="emit('lyric', item)">
        <v-icon icon="mdi-script-text-outline" aria-hidden="true" />
        <v-tooltip activator="parent" location="bottom" text="歌詞" />
      </button>
      <button type="button" class="hymn-card__btn" aria-label="楽譜ダウンロード" @click="emit('score', item.id)">
        𝄞
        <v-tooltip activator="parent" location="bottom" text="楽譜ダウンロード" />
      </button>
    </div>
  </article>

  <div v-else class="glass-card is-slide" aria-hidden="true">
    <div class="d-flex flex-column ga-2">
      <v-skeleton-loader type="text" class="hymn-card__skeleton" />
      <v-skeleton-loader type="text" width="80%" class="hymn-card__skeleton" />
      <v-skeleton-loader type="text" width="60%" class="hymn-card__skeleton" />
    </div>
    <v-skeleton-loader type="avatar" width="28" height="28" class="hymn-card__skeleton align-self-end" />
  </div>
</template>

<style scoped>
/* カードのエフェクト: 浮き上がり・押したときの縮み・色別の光(外側+内側の2重。端で外側が切れても光って見える) */
.hymn-card {
  height: 100%;
  transition: translate 0.3s, scale 0.3s, box-shadow 0.3s;
}
@media (hover: hover) {
  .hymn-card:hover {
    translate: 0 -4px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
  }
  .hymn-card.glow-BURGUNDY:hover {
    box-shadow: 0 0 28px rgba(192, 64, 95, 0.6), inset 0 0 22px rgba(192, 64, 95, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
  }
  .hymn-card.glow-NAPLES:hover {
    box-shadow: 0 0 28px rgba(246, 201, 28, 0.6), inset 0 0 22px rgba(246, 201, 28, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
  }
  .hymn-card.glow-CADMIUM:hover {
    box-shadow: 0 0 28px rgba(46, 204, 113, 0.55), inset 0 0 22px rgba(46, 204, 113, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
  }
}
.hymn-card:active {
  scale: 0.98;
}
.hymn-card__title {
  position: relative;
  z-index: 1;
  font-size: 1.3rem;
  font-weight: 600;
  line-height: 1.5;
  color: #fff;
  text-decoration: none;
  text-underline-offset: 2px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.66);
}
.hymn-card__title:hover {
  text-decoration: underline;
}
.hymn-card__actions {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  margin-top: 12px;
}
/* 歌詞・楽譜ボタン(𝄞 と歌詞アイコンを同じ大きさ・白・影に揃える) */
.hymn-card__btn {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: 0;
  background: none;
  font-size: 2.2rem;
  line-height: 1;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.66);
  transition: scale 0.15s, opacity 0.15s;
}
.hymn-card__btn .v-icon {
  font-size: 0.85em;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.66));
}
.hymn-card__btn:hover {
  scale: 1.2;
  opacity: 0.85;
}
.hymn-card__skeleton {
  background: transparent;
}
.hymn-card__skeleton :deep(.v-skeleton-loader__bone) {
  background: rgba(255, 255, 255, 0.6);
}
</style>
