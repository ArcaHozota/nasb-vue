<script setup lang="ts">
// src/components/RedLetterEditor.vue
// 旧 components/RedLetterEditor.tsx を移植。
// contentEditableな<div>に対してDOM操作で「{{...}}」記法⇔赤字spanを相互変換する。
import { ref, watch } from "vue";
import { EMPTY_STRING } from "@/constants";

type Segment = { text: string; red: boolean };

const MARKER_REGEX = /\{\{([\s\S]*?)\}\}/g;

function parseToSegments(raw: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  MARKER_REGEX.lastIndex = 0;
  while ((m = MARKER_REGEX.exec(raw)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ text: raw.slice(lastIndex, m.index), red: false });
    }
    segments.push({ text: m[1], red: true });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < raw.length) {
    segments.push({ text: raw.slice(lastIndex), red: false });
  }
  if (segments.length === 0) segments.push({ text: EMPTY_STRING, red: false });
  return segments;
}

function segmentsToRaw(segments: Segment[]): string {
  return segments
    .map((s) => (s.red ? `{{${s.text}}}` : s.text))
    .join(EMPTY_STRING);
}

function domToSegments(container: HTMLElement): Segment[] {
  const segments: Segment[] = [];
  container.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      segments.push({ text: node.textContent ?? EMPTY_STRING, red: false });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      segments.push({
        text: el.textContent ?? EMPTY_STRING,
        red: el.classList.contains("red-letter"),
      });
    }
  });
  return segments;
}

function renderSegments(container: HTMLElement, segments: Segment[]) {
  container.innerHTML = EMPTY_STRING;
  segments.forEach((seg) => {
    if (seg.red) {
      const span = document.createElement("span");
      span.className = "red-letter";
      span.textContent = seg.text;
      container.appendChild(span);
    } else if (seg.text) {
      container.appendChild(document.createTextNode(seg.text));
    }
  });
}

function getCaretOffset(container: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

function setCaretOffset(container: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
    remaining -= len;
  }
  const range = document.createRange();
  range.selectNodeContents(container);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

// 指定ノードから container に向かって遡り、red-letter span を探す
function findRedLetterAncestor(
  node: Node | null,
  container: HTMLElement,
): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur !== container) {
    if (
      cur.nodeType === Node.ELEMENT_NODE &&
      (cur as HTMLElement).classList.contains("red-letter")
    ) {
      return cur as HTMLElement;
    }
    cur = cur.parentNode;
  }
  return null;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    error?: boolean;
    helperText?: string;
    minHeight?: number;
  }>(),
  { minHeight: 84 },
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const containerEl = ref<HTMLElement | null>(null);
// ReactではuseRefで持っていたインスタンス変数。Vueではreactivity不要なので
// ただのクロージャ変数として保持する(コンポーネントインスタンスごとに独立する)。
let skipNextSync = false;
let isComposing = false;

// 外部からのmodelValue変更(初期化・保存後のクリアなど)の時だけDOMを作り直す
watch(
  () => props.modelValue,
  (value) => {
    if (skipNextSync) {
      skipNextSync = false;
      return;
    }
    const el = containerEl.value;
    if (!el) return;
    renderSegments(el, parseToSegments(value));
  },
  { immediate: true, flush: "post" },
);

const reconcile = () => {
  const el = containerEl.value;
  if (!el) return;
  const caret = getCaretOffset(el);
  const segments = domToSegments(el);
  const raw = segmentsToRaw(segments);
  skipNextSync = true;
  emit("update:modelValue", raw);
  requestAnimationFrame(() => {
    if (!containerEl.value) return;
    renderSegments(containerEl.value, segments);
    setCaretOffset(containerEl.value, caret);
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

defineExpose({
  wrapSelection: () => {
    const el = containerEl.value;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;

    // 選択範囲がすでに1つの赤文字spanと一致する場合は、通常の文字列に戻す(トグル解除)
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
  },
});
</script>

<template>
  <div>
    <div
      ref="containerEl"
      contenteditable="true"
      :data-placeholder="placeholder"
      class="noto-serif red-letter-editor"
      :class="{ 'is-error': error }"
      :style="{ minHeight: `${minHeight}px` }"
      @input="onInput"
      @compositionstart="onCompositionStart"
      @compositionend="onCompositionEnd"
    />
    <p v-if="helperText" class="mt-1 text-xs" :class="error ? 'text-red-700' : 'text-gray-600'">
      {{ helperText }}
    </p>
  </div>
</template>

<style scoped>
.red-letter-editor {
  padding: 16.5px 14px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.23);
  font-size: 1rem;
  line-height: 1.4375;
  outline: none;
  white-space: pre-wrap;
  word-break: break-word;
  background: #fff;
}

.red-letter-editor.is-error {
  border-color: #d32f2f;
}

.red-letter-editor:focus {
  border-color: #c62828;
  border-width: 2px;
  /* 枠が太くなる分だけ内側を詰めてガタつきを防ぐ */
  padding: 15.5px 13px;
}

.red-letter-editor:empty:before {
  content: attr(data-placeholder);
  color: rgba(0, 0, 0, 0.5);
}

:deep(.red-letter) {
  color: #c62828;
}
</style>
