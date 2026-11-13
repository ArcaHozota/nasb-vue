<script setup lang="ts">
// 最大2行で「…」省略するテキスト(旧 components/ClampText.tsx)。
// 実際に省略されている時だけ、ホバーで全文をツールチップ表示する
// (省略されていない短い名称にまでツールチップが出るとうるさいため)。
//
// v-tooltip は一度開くと中身を DOM に残す(Radix は閉じると消す)ので、省略されている間だけ
// v-tooltip 自体を置く(省略されなくなったら中身ごと消える)。省略されているかは表示時と大きさが変わった時に測る。
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{ text: string }>();

const el = ref<HTMLElement | null>(null);
const clamped = ref(false);

const measure = () => {
  const e = el.value;
  clamped.value = !!e && e.scrollHeight > e.clientHeight + 1;
};

let observer: ResizeObserver | undefined;
onMounted(() => {
  measure();
  if (typeof ResizeObserver !== "undefined" && el.value) {
    observer = new ResizeObserver(measure);
    observer.observe(el.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());
// 文字が変わったら(ページ送りで行が使い回された時など)測り直す
watch(() => props.text, () => requestAnimationFrame(measure));
</script>

<template>
  <span ref="el" class="line-clamp-2">
    {{ text }}
    <v-tooltip v-if="clamped" activator="parent" max-width="384" :text="text" />
  </span>
</template>
