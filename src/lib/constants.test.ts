import { describe, expect, it } from "vitest";
import { base64ToUtf8, extractErrorMessage, utf8ToBase64 } from "./constants";
import { required } from "./form";

describe("utf8ToBase64 / base64ToUtf8", () => {
  it("ASCII は標準の Base64 になる", () => {
    expect(utf8ToBase64("abc")).toBe("YWJj");
  });

  it("日本語・ハングルも往復で元に戻る", () => {
    for (const s of ["こんにちは", "사랑", "B♭ 𝄞"]) {
      expect(base64ToUtf8(utf8ToBase64(s))).toBe(s);
    }
  });
});

describe("extractErrorMessage", () => {
  it.each([
    undefined,
    null,
    "",
    " \t\n　",
    0,
    false,
    [],
    {},
    { message: undefined },
    { message: null },
    { message: "" },
    { message: " \t\n　" },
    { message: 123 },
    { message: false },
    { message: [] },
    { message: {} },
    { message: { message: "nested" } },
  ])("空・無効な応答 %j には既定文言を使う", (data) => {
    expect(
      extractErrorMessage({ response: { data } }, "保存に失敗しました"),
    ).toBe("保存に失敗しました");
  });

  it.each(["  詳細なエラーです\n", { message: "  詳細なエラーです\n" }])(
    "有効な文言は前後の空白だけを除いて保持する: %j",
    (data) => {
      expect(extractErrorMessage({ response: { data } }, "fallback")).toBe(
        "詳細なエラーです",
      );
    },
  );

  it("応答本文が文字列ならそれを返す", () => {
    expect(
      extractErrorMessage({ response: { data: "重複しています" } }, "fb"),
    ).toBe("重複しています");
  });

  it("応答本文の message を返す", () => {
    expect(
      extractErrorMessage({ response: { data: { message: "失敗" } } }, "fb"),
    ).toBe("失敗");
  });

  it("読めなければ fallback", () => {
    expect(extractErrorMessage(new Error("x"), "fb")).toBe("fb");
    expect(extractErrorMessage(null, "fb")).toBe("fb");
    expect(
      extractErrorMessage({ response: { data: { other: 1 } } }, "fb"),
    ).toBe("fb");
  });
});

describe("required", () => {
  it("空・空白だけならエラー文言", () => {
    expect(required("")).not.toBe("");
    expect(required("  ")).not.toBe("");
  });

  it("入力があれば空文字", () => {
    expect(required("a")).toBe("");
  });

  it("エラー文言は「入力してください。」", () => {
    expect(required("")).toBe("入力してください。");
  });
});
