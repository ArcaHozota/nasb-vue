<script setup lang="ts">
// 楽譜の調を選ぶ中央ダイアログ(モバイル用。旧 components/ScoreKeyDialog.tsx)。
// 開閉は親が v-model で管理する。調を選ぶと select を発火して閉じる。
import { chordLabel, type ScoreKey } from "@/lib/scoreKeys";

defineProps<{
  /** 曲名など(説明文として表示) */
  title?: string;
  keys: ScoreKey[];
  contentClass?: string;
  itemClass?: string;
}>();

const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ select: [chord: string] }>();

const onSelect = (chord: string) => {
  open.value = false;
  emit("select", chord);
};
</script>

<template>
  <v-dialog v-model="open" max-width="320" aria-labelledby="score-key-dialog-title">
    <v-card :class="['noto-serif pa-6', contentClass]" rounded="lg">
      <h2 id="score-key-dialog-title" class="text-h6 font-weight-bold">調を選択</h2>
      <p :class="['text-body-2 mt-1', contentClass ? 'score-key-dialog__desc' : 'text-medium-emphasis']">
        {{ title ?? "ダウンロードする調を選んでください。" }}
      </p>
      <div class="score-key-dialog__grid mt-4">
        <v-btn
          v-for="k in keys"
          :key="k.chord"
          variant="outlined"
          rounded="xl"
          :class="['score-key-dialog__item', itemClass]"
          @click="onSelect(k.chord)"
        >
          {{ chordLabel(k.chord) }}{{ k.isOriginal ? "*" : "" }}
        </v-btn>
      </div>
      <p class="text-caption mt-4 score-key-dialog__desc">* はオリジナルキー</p>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.score-key-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.score-key-dialog__item {
  height: auto !important;
  min-height: 48px;
  font-size: 1.125rem;
  letter-spacing: normal;
}
.score-key-dialog__desc {
  opacity: 0.85;
}
</style>
