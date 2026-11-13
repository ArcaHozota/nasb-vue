<script setup lang="ts">
// 選んだ長調の調号を描いたト音記号の五線譜。押すとその調の楽譜をダウンロードする(PC版ホーム)。
// 旧 components/home/KeyStaff.tsx
import { computed } from "vue";
import { accidentalSteps, keySignature } from "@/lib/keySignature";
import { TREBLE_CLEF_G_LINE, TREBLE_CLEF_PATH } from "@/lib/trebleClef";

const props = defineProps<{
  /** 選択中の調(null: 楽譜なし・読み込み中) */
  chord: string | null;
  isOriginal: boolean;
  /** ready: 押せる / loading: 調の一覧を取得中 / empty: 楽譜未登録 / downloading: ダウンロード中 */
  state: "ready" | "loading" | "empty" | "downloading";
}>();
const emit = defineEmits<{ download: [] }>();

// 五線の位置(viewBox 上の y)。線の間隔 8、段(線と間)の間隔 4
const TOP_LINE_Y = 20;
const STEP = 4;
const LINES = [0, 1, 2, 3, 4].map((i) => TOP_LINE_Y + i * STEP * 2);
// ト音記号: 線の間隔 8 に対して約 7.4 段分の高さ(楽譜の標準的な大きさ)。
// 渦巻きの中心が第2線(G4)に来るように置く
const CLEF_SCALE = 0.034;
const G_LINE_Y = LINES[3];
const CLEF_TRANSFORM = `translate(4 ${G_LINE_Y + TREBLE_CLEF_G_LINE * CLEF_SCALE}) scale(${CLEF_SCALE} ${-CLEF_SCALE})`;

const sig = computed(() => keySignature(props.chord));
const isSharp = computed(() => sig.value?.accidental === "sharp");
// 記号の中心を、その音の線(または間)の高さにぴったり合わせる
const marks = computed(() =>
  accidentalSteps(sig.value).map((s, i) => ({ cx: 48 + i * 11, cy: TOP_LINE_Y + s * STEP })),
);
const disabled = computed(() => props.state !== "ready");

const title = computed(() => {
  if (props.state === "empty") return "楽譜未登録";
  if (props.state === "loading" || !sig.value) return "楽譜を確認しています…";
  return `${sig.value.nameJa}（${sig.value.label}）${props.isOriginal ? "・オリジナルキー" : ""}`;
});
const ariaLabel = computed(() =>
  sig.value && props.state === "ready" ? `${sig.value.nameJa}の楽譜をダウンロード` : title.value,
);

/** ♭: 縦棒の下端の丸み(ふくらみ)の中心が cy に来る */
const flatPath = (cx: number, cy: number) => {
  const x = cx - 3;
  return `M ${x} ${cy + 4} C ${x + 8} ${cy}, ${x + 7} ${cy - 5}, ${x} ${cy - 1}`;
};
</script>

<template>
  <!-- 五線譜そのものがボタン。薄い罫線の面にする -->
  <button
    type="button"
    class="key-staff"
    :disabled="disabled"
    :aria-label="ariaLabel"
    @click="emit('download')"
  >
    <svg width="300" height="72" viewBox="0 0 300 72" aria-hidden="true">
      <g stroke="currentColor" stroke-width="1">
        <line v-for="y in LINES" :key="y" x1="0" :y1="y" x2="300" :y2="y" />
        <line x1="299" :y1="LINES[0]" x2="299" :y2="LINES[4]" />
      </g>
      <path :d="TREBLE_CLEF_PATH" :transform="CLEF_TRANSFORM" fill="currentColor" />
      <!-- ♯・♭はフォントの字形ではなく線で描く(OS・フォントによって位置がずれないように) -->
      <template v-for="(m, i) in marks" :key="i">
        <g v-if="isSharp" stroke="currentColor" stroke-linecap="butt">
          <line :x1="m.cx - 2" :y1="m.cy - 7" :x2="m.cx - 2" :y2="m.cy + 9" stroke-width="1.2" />
          <line :x1="m.cx + 2" :y1="m.cy - 9" :x2="m.cx + 2" :y2="m.cy + 7" stroke-width="1.2" />
          <line :x1="m.cx - 4.5" :y1="m.cy - 1.5" :x2="m.cx + 4.5" :y2="m.cy - 4" stroke-width="2.2" />
          <line :x1="m.cx - 4.5" :y1="m.cy + 4" :x2="m.cx + 4.5" :y2="m.cy + 1.5" stroke-width="2.2" />
        </g>
        <g v-else stroke="currentColor" fill="none">
          <line :x1="m.cx - 3" :y1="m.cy - 12" :x2="m.cx - 3" :y2="m.cy + 4" stroke-width="1.3" />
          <path :d="flatPath(m.cx, m.cy)" stroke-width="1.8" />
        </g>
      </template>
    </svg>
    <span class="key-staff__text">
      <span class="key-staff__title">{{ title }}</span>
      <span v-if="state === 'ready'" class="key-staff__hint book-sans">
        楽譜をダウンロード
        <v-icon icon="mdi-download" size="14" aria-hidden="true" />
      </span>
      <span v-else-if="state === 'downloading'" class="key-staff__hint book-sans">
        <v-progress-circular indeterminate size="14" width="2" /> ダウンロードしています…
      </span>
    </span>
  </button>
</template>

<style scoped>
.key-staff {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 18px;
  padding: 6px 14px 6px 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #4a3426;
  font-size: 1rem;
  line-height: 1.5;
  text-align: left;
  transition: background-color 0.15s, border-color 0.15s;
}
.key-staff:not(:disabled):hover {
  border-color: #c9b48d;
  background: #f3e8cf;
}
.key-staff:focus-visible {
  outline: 2px solid #800020;
  outline-offset: 2px;
}
.key-staff:disabled {
  color: #b8a888;
}
.key-staff svg {
  flex-shrink: 0;
  width: 300px;
  height: 72px;
}
.key-staff__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.key-staff__title {
  font-size: 17px;
  font-weight: 700;
}
.key-staff__hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  line-height: 1.5;
  color: #800020;
}
</style>
