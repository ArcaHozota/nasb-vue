import { describe, expect, it } from "vitest";
import { base64ToUtf8, extractMessage, utf8ToBase64 } from "./constants";
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

describe("extractMessage", () => {
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
    expect(extractMessage(data, "保存に失敗しました")).toBe(
      "保存に失敗しました",
    );
    expect(
      extractMessage({ response: { data } }, "保存に失敗しました"),
    ).toBe("保存に失敗しました");
  });

  it.each(["  詳細なエラーです\n", { message: "  詳細なエラーです\n" }])(
    "有効な文言は前後の空白だけを除いて保持する: %j",
    (data) => {
      expect(extractMessage(data, "fallback")).toBe("詳細なエラーです");
      expect(extractMessage({ response: { data } }, "fallback")).toBe(
        "詳細なエラーです",
      );
    },
  );

  it("応答本文が文字列ならそれを返す", () => {
    expect(
      extractMessage({ response: { data: "重複しています" } }, "fb"),
    ).toBe("重複しています");
  });

  it("応答本文の message を返す", () => {
    expect(
      extractMessage({ response: { data: { message: "失敗" } } }, "fb"),
    ).toBe("失敗");
  });

  it("読めなければ fallback", () => {
    expect(extractMessage(new Error("x"), "fb")).toBe("fb");
    expect(extractMessage(null, "fb")).toBe("fb");
    expect(
      extractMessage({ response: { data: { other: 1 } } }, "fb"),
    ).toBe("fb");
  });

  it("Axios エラーでは通信エラーの message より応答本文を優先する", () => {
    const error = Object.assign(new Error("Request failed"), {
      response: { data: { message: "保存できません" } },
    });
    expect(extractMessage(error, "fb")).toBe("保存できません");
    error.response.data.message = " ";
    expect(extractMessage(error, "fb")).toBe("fb");
  });

  it("空文字の既定文言も保持する", () => {
    expect(extractMessage({ response: { data: " " } }, "")).toBe("");
    expect(extractMessage(undefined, "")).toBe("");
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
