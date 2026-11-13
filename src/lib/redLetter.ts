// src/lib/redLetter.ts
// RedLetterEditor の「{{...}}」記法 ⇔ 赤字 span の相互変換と、キャレット位置の保存・復元。
// (旧 components/RedLetterEditor.tsx の中にあった関数を、画面から切り離してテストできるようにしたもの)
import { EMPTY_STRING } from "@/lib/constants";

export type Segment = { text: string; red: boolean };

const MARKER_REGEX = /\{\{([\s\S]*?)\}\}/g;

export function parseToSegments(raw: string): Segment[] {
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

export function segmentsToRaw(segments: Segment[]): string {
  return segments
    .map((s) => (s.red ? `{{${s.text}}}` : s.text))
    .join(EMPTY_STRING);
}

export function domToSegments(container: HTMLElement): Segment[] {
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

export function renderSegments(container: HTMLElement, segments: Segment[]) {
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

export function getCaretOffset(container: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

export function setCaretOffset(container: HTMLElement, offset: number) {
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
export function findRedLetterAncestor(
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

