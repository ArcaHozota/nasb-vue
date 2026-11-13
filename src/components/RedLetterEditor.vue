<script setup lang="ts">
// 赤字(イエスの言葉)を入れられる入力欄(旧 components/RedLetterEditor.tsx)。
// contentEditable な <div> に対して DOM 操作で「{{...}}」記法 ⇔ 赤字 span を相互変換する。
// 親は v-model で生の文字列(「{{...}}」記法)を受け取り、ref 経由で wrapSelection() を呼ぶ。
import { onMounted, ref, watch } from "vue";
import { EMPTY_STRING } from "@/lib/constants";
import {
  domToSegments,
  findRedLetterAncestor,
  getCaretOffset,
  parseToSegments,
  renderSegments,
  segmentsToRaw,
  setCaretOffset,
} from "@/lib/redLetter";

withDefaults(
  defineProps<{
    placeholder?: string;
    error?: boolean;
    helperText?: string;
    minHeight?: number;
  }>(),
  { minHeight: 84 },
);
const model = defineModel<string>({ required: true });

const container = ref<HTMLDivElement | null>(null);
// 自分の入力で model を更新したときは、DOM を作り直さない(キャレットが飛ぶため)
let skipNextSync = false;
let isComposing = false;

// 外部からの値の変更(初期化・保存後のクリアなど)の時だけ DOM を作り直す
watch(model, (value) => {
  if (skipNextSync) {
    skipNextSync = false;
    return;
  }
  if (container.value) renderSegments(container.value, parseToSegments(value));
});
onMounted(() => {
  if (container.value) renderSegments(container.value, parseToSegments(model.value));
});

const reconcile = () => {
  const el = container.value;
  if (!el) return;
  const caret = getCaretOffset(el);
  const segments = domToSegments(el);
  const raw = segmentsToRaw(segments);
  // 値が変わらないときは watch が走らないので、フラグを立てない
  if (raw !== model.value) {
    skipNextSync = true;
    model.value = raw;
  }
  requestAnimationFrame(() => {
    if (!container.value) return;
    renderSegments(container.value, segments);
    setCaretOffset(container.value, caret);
  });
};

const onInput = () => {
  if (!isComposing) reconcile();
};
const onCompositionStart = () => {
  isComposing = true;
};
const onCompositionEnd = () => {
  isComposing = false;
  reconcile();
};

/** 選択範囲を赤字にする。選択範囲がすでに1つの赤字 span と一致する場合は通常の文字に戻す(トグル) */
const wrapSelection = () => {
  const el = container.value;
  const sel = window.getSelection();
  if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) return;

  const startSpan = findRedLetterAncestor(range.startContainer, el);
  const endSpan = findRedLetterAncestor(range.endContainer, el);
  if (startSpan && startSpan === endSpan) {
    const textNode = document.createTextNode(startSpan.textContent ?? EMPTY_STRING);
    startSpan.parentNode?.replaceChild(textNode, startSpan);
    const newRange = document.createRange();
    newRange.setStart(textNode, textNode.length);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    reconcile();
    return;
  }

  const span = document.createElement("span");
  span.className = "red-letter";
  span.appendChild(range.extractContents());
  range.insertNode(span);
  const newRange = document.createRange();
  newRange.setStartAfter(span);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
  reconcile();
};

defineExpose({ wrapSelection });
</script>

<template>
  <div>
    <div
      ref="container"
      contenteditable="true"
      :data-placeholder="placeholder"
      :class="['noto-serif red-letter-editor', { 'is-error': error }]"
      :style="{ minHeight: `${minHeight}px` }"
      @input="onInput"
      @compositionstart="onCompositionStart"
      @compositionend="onCompositionEnd"
    />
    <p
      v-if="helperText"
      :class="['text-caption mt-1', error ? 'text-error' : 'text-medium-emphasis']"
    >
      {{ helperText }}
    </p>
  </div>
</template>
