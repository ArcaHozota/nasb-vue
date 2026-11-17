import { describe, expect, it, vi } from "vitest";
import { effectScope, ref } from "vue";
import { useDuplicateCheck } from "./useDuplicateCheck";

const deferred = () => {
  let resolve!: (value?: unknown) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const conflict = { isAxiosError: true, response: { status: 409, data: "" } };
function setup(request: (value: string, signal: AbortSignal) => Promise<unknown>) {
  const scope = effectScope();
  const value = ref("old");
  const check = scope.run(() => useDuplicateCheck({
    value, request, duplicateMessage: "重複しています", failureMessage: "通信に失敗しました",
  }))!;
  return { scope, value, ...check };
}

describe("重複チェック", () => {
  it("古い失敗応答で、変更後の値や検査中の状態を上書きしない", async () => {
    const old = deferred(), latest = deferred();
    const request = vi.fn((value: string) => value === "old" ? old.promise : latest.promise);
    const check = setup(request);
    try {
      const first = check.check();
      await Promise.resolve();
      check.value.value = "latest";
      const second = check.check();
      old.reject(conflict);
      expect(await first).toBe(false);
      expect(check.error.value).toBe("");
      expect(check.checking.value).toBe(true);
      latest.resolve();
      expect(await second).toBe(true);
      expect(check.checking.value).toBe(false);
    } finally { check.scope.stop(); }
  });

  it("古い成功応答で、最新の重複エラーを消さない", async () => {
    const old = deferred();
    const check = setup((value) => value === "old" ? old.promise : Promise.reject(conflict));
    try {
      const first = check.check();
      check.value.value = "latest";
      expect(await check.check()).toBe(false);
      old.resolve();
      expect(await first).toBe(false);
      expect(check.error.value).toBe("重複しています");
    } finally { check.scope.stop(); }
  });

  it("入力を元の値に戻した場合も、それ以前の応答は無効にする", async () => {
    const old = deferred();
    const check = setup(() => old.promise);
    try {
      const first = check.check();
      check.value.value = "other";
      check.value.value = "old";
      old.reject(conflict);
      expect(await first).toBe(false);
      expect(check.error.value).toBe("");
    } finally { check.scope.stop(); }
  });

  it("blurと保存が重なった検査は同じ完了を待つ", async () => {
    const result = deferred();
    const request = vi.fn(() => result.promise);
    const check = setup(request);
    try {
      const blur = check.check(), submit = check.check();
      expect(submit).toBe(blur);
      result.resolve();
      expect(await submit).toBe(true);
      expect(request).toHaveBeenCalledTimes(1);
    } finally { check.scope.stop(); }
  });

  it("通信失敗を重複と区別し、同じ値でも再試行できる", async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    const check = setup(request);
    try {
      expect(await check.check()).toBe(false);
      expect(check.error.value).toBe("通信に失敗しました");
      expect(await check.check()).toBe(true);
      expect(check.error.value).toBe("");
    } finally { check.scope.stop(); }
  });

  it("破棄・画面離脱時に通信を中止し、後から来る応答を無視する", async () => {
    const result = deferred();
    let signal!: AbortSignal;
    const check = setup((_value, current) => { signal = current; return result.promise; });
    const pending = check.check();
    await Promise.resolve();
    check.scope.stop();
    expect(signal.aborted).toBe(true);
    result.reject(conflict);
    expect(await pending).toBe(false);
    expect(check.error.value).toBe("");
  });

  it("同期的に失敗した検査も再試行できる", async () => {
    const check = setup(vi.fn().mockImplementationOnce(() => { throw new Error("sync"); }).mockResolvedValue(undefined));
    try {
      expect(await check.check()).toBe(false);
      expect(await check.check()).toBe(true);
    } finally { check.scope.stop(); }
  });
});
