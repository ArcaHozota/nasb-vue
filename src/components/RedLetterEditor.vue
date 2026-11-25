<script setup lang="ts">
// 赤字(イエスの言葉)を入れられる入力欄(旧 components/RedLetterEditor.tsx)。
// contentEditable な <div> に対して DOM 操作で「{{...}}」記法 ⇔ 赤字 span を相互変換する。
// 親は v-model で生の文字列(「{{...}}」記法)を受け取り、ref 経由で wrapSelection() を呼ぶ。
import { onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
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

const props = withDefaults(
  defineProps<{
    labelledBy: string;
    placeholder?: string;
    error?: boolean;
    helperText?: string;
    minHeight?: number;
    disabled?: boolean;
  }>(),
  { minHeight: 84, disabled: false },
);
const model = defineModel<string>({ required: true });
const helperId = `red-letter-helper-${useId()}`;

const container = ref<HTMLDivElement | null>(null);
let isComposing = false;
let renderFrame: number | undefined;
const cancelRender = () => {
  if (renderFrame !== undefined) cancelAnimationFrame(renderFrame);
  renderFrame = undefined;
};
onBeforeUnmount(cancelRender);

// 外部からの値の変更(初期化・保存後のクリアなど)の時だけ DOM を作り直す
watch(model, (value) => {
  const el = container.value;
  // 自分の入力が反映された場合は、DOM を作り直さない(キャレットが飛ぶため)。
  if (!el || value === segmentsToRaw(domToSegments(el))) return;
  cancelRender();
  renderSegments(el, parseToSegments(value));
});
onMounted(() => {
  if (container.value)
    renderSegments(container.value, parseToSegments(model.value));
});

const reconcile = () => {
  const el = container.value;
  if (!el || props.disabled) return;
  const caret = getCaretOffset(el);
  const segments = domToSegments(el);
  const raw = segmentsToRaw(segments);
  if (raw !== model.value) model.value = raw;
  // 新しい入力や外部からの初期化を、古い描画予約で上書きしない。
  cancelRender();
  renderFrame = requestAnimationFrame(() => {
    renderFrame = undefined;
    if (!container.value) return;
    renderSegments(container.value, segments);
    if (document.activeElement === container.value)
      setCaretOffset(container.value, caret);
  });
};

const onInput = () => {
  if (!isComposing) reconcile();
};
const onBeforeInput = (e: InputEvent) => {
  if (
    e.inputType !== "insertLineBreak" ||
    e.isComposing ||
    isComposing ||
    props.disabled
  )
    return;
  const el = container.value;
  const selection = window.getSelection();
  if (!el || !selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) return;
  // Shift+Enter は改行を1つだけ挿入する。ブラウザによる末尾の余分な改行を避ける。
  e.preventDefault();
  range.deleteContents();
  const newline = document.createTextNode("\n");
  range.insertNode(newline);
  // 本文の最後に改行したときは、すぐに <br> を添える(renderSegments と同じ形)。
  // 末尾の改行だけだと、次の描画までの間に続けて入力した文字が改行の前に入ってしまう
  // (ブラウザが「末尾の改行の後ろ」を「改行の前」として扱うため)。<br> は読み取り時に本文に含めない。
  const tail = document.createRange();
  tail.setStartAfter(newline);
  tail.setEnd(el, el.childNodes.length);
  if (tail.toString() === "" && !tail.cloneContents().querySelector("br"))
    el.appendChild(document.createElement("br"));
  range.setStartAfter(newline);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  reconcile();
};
const onCompositionStart = () => {
  cancelRender();
  isComposing = true;
};
const onCompositionEnd = () => {
  isComposing = false;
  reconcile();
};

/** 選択範囲を赤字にする。選択範囲がすでに1つの赤字 span と一致する場合は通常の文字に戻す(トグル) */
const wrapSelection = () => {
  if (props.disabled) return;
  const el = container.value;
  const sel = window.getSelection();
  if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) return;

  const startSpan = findRedLetterAncestor(range.startContainer, el);
  const endSpan = findRedLetterAncestor(range.endContainer, el);
  if (startSpan && startSpan === endSpan) {
    const textNode = document.createTextNode(
      startSpan.textContent ?? EMPTY_STRING,
    );
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
      role="textbox"
      aria-multiline="true"
      :aria-labelledby="labelledBy"
      :aria-invalid="!!error"
      :aria-describedby="helperText ? helperId : undefined"
      :contenteditable="!disabled"
      :aria-disabled="disabled"
      :data-placeholder="placeholder"
      :class="[
        'noto-serif red-letter-editor',
        { 'is-error': error, 'is-disabled': disabled },
      ]"
      :style="{ minHeight: `${minHeight}px` }"
      @input="onInput"
      @beforeinput="onBeforeInput"
      @compositionstart="onCompositionStart"
      @compositionend="onCompositionEnd"
    />
    <p
      v-if="helperText"
      :id="helperId"
      :class="[
        'text-body-small mt-1',
        error ? 'text-error' : 'text-medium-emphasis',
      ]"
    >
      {{ helperText }}
    </p>
  </div>
</template>
