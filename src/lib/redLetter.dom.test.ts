// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  domToSegments,
  findRedLetterAncestor,
  parseToSegments,
  renderSegments,
  segmentsToRaw,
} from "./redLetter";

describe("「{{...}}」記法 ⇔ 区間", () => {
  it("赤字の区間に分け、元の文字列に戻せる", () => {
    const raw = "イエスは言われた。{{わたしは道です。}}そして";
    const segs = parseToSegments(raw);
    expect(segs).toEqual([
      { text: "イエスは言われた。", red: false },
      { text: "わたしは道です。", red: true },
      { text: "そして", red: false },
    ]);
    expect(segmentsToRaw(segs)).toBe(raw);
  });

  it("空文字は空の区間1つ", () => {
    expect(parseToSegments("")).toEqual([{ text: "", red: false }]);
  });
});

describe("DOM との相互変換", () => {
  it("赤字は span.red-letter になり、DOM から同じ区間に戻る", () => {
    const el = document.createElement("div");
    const segs = parseToSegments("a{{b}}c");
    renderSegments(el, segs);
    expect(el.innerHTML).toBe('a<span class="red-letter">b</span>c');
    expect(domToSegments(el)).toEqual(segs);
  });

  it("赤字 span の中のノードから、その span を見つける", () => {
    const el = document.createElement("div");
    renderSegments(el, parseToSegments("a{{b}}"));
    const span = el.querySelector(".red-letter")!;
    expect(findRedLetterAncestor(span.firstChild, el)).toBe(span);
    expect(findRedLetterAncestor(el.firstChild, el)).toBeNull();
  });
});
