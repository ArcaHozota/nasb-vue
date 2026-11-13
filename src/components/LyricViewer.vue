<script setup lang="ts">
// ホーム画面の歌詞表示(旧 components/LyricViewer.tsx)。
// モバイルは画面下から出るシート(v-bottom-sheet)、PCは中央のダイアログ(v-dialog)。
// 検索した韓国語に一致する部分をハイライトする(歌詞の照合)。
import { computed } from "vue";
import LyricBody from "@/components/LyricBody.vue";

export type LyricTarget = {
  id: string;
  nameJp: string;
  nameKr: string;
  lineNumber: string;
};

const props = defineProps<{
  /** 表示する曲。null なら閉じている */
  target: LyricTarget | null;
  /** ハイライトする語(検索キーワードを分解したもの) */
  terms: string[];
  /** sheet: モバイル(画面下から) / dialog: PC(中央) */
  variant: "sheet" | "dialog";
  /** カードと同じすりガラス・色 */
  contentClass?: string;
}>();
const emit = defineEmits<{ close: [] }>();

const open = computed({
  get: () => props.target !== null,
  set: (o) => {
    if (!o) emit("close");
  },
});
</script>

<template>
  <v-bottom-sheet v-if="variant === 'sheet'" v-model="open" aria-labelledby="lyric-viewer-title">
    <div :class="['lyric-viewer lyric-viewer--sheet', contentClass]">
      <template v-if="target">
        <div class="px-4 pt-4">
          <h2 id="lyric-viewer-title" class="noto-serif text-subtitle-1 font-weight-bold">
            {{ target.nameJp }}
          </h2>
          <p class="noto-serif text-body-2 lyric-viewer__sub">{{ target.nameKr }}</p>
        </div>
        <div class="lyric-viewer__scroll d-flex flex-column ga-2 px-4">
          <LyricBody :id="target.id" :terms="terms" />
        </div>
      </template>
    </div>
  </v-bottom-sheet>

  <v-dialog v-else v-model="open" max-width="576" aria-labelledby="lyric-viewer-title">
    <div :class="['lyric-viewer lyric-viewer--dialog', contentClass]">
      <template v-if="target">
        <div>
          <h2 id="lyric-viewer-title" class="noto-serif text-h6 font-weight-bold">
            {{ target.nameJp }}
          </h2>
          <p class="noto-serif text-body-2 lyric-viewer__sub">{{ target.nameKr }}</p>
        </div>
        <div class="lyric-viewer__scroll d-flex flex-column ga-2 pr-3">
          <LyricBody :id="target.id" :terms="terms" />
        </div>
      </template>
    </div>
  </v-dialog>
</template>

<style scoped>
.lyric-viewer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #fff;
}
.lyric-viewer--sheet {
  max-height: 85svh;
  padding-bottom: 24px;
  border-radius: 18px 18px 0 0;
}
.lyric-viewer--dialog {
  max-height: 80vh;
  gap: 12px;
  padding: 24px;
  border-radius: 12px;
}
.lyric-viewer__sub {
  opacity: 0.85;
}
.lyric-viewer__scroll {
  min-height: 0;
  overflow-y: auto;
}
</style>
