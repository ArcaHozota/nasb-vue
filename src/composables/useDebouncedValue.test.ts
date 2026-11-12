import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useDebouncedValue } from "./useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("delay のあいだ変わらなかったら、最後の値になる", async () => {
    const scope = effectScope();
    const source = ref("a");
    const debounced = scope.run(() => useDebouncedValue(source, 300))!;
    expect(debounced.value).toBe("a");

    source.value = "ab";
    await nextTick();
    vi.advanceTimersByTime(200);
    source.value = "abc";
    await nextTick();
    vi.advanceTimersByTime(200);
    expect(debounced.value).toBe("a"); // 途中の値はまだ反映しない

    vi.advanceTimersByTime(100);
    expect(debounced.value).toBe("abc");
    scope.stop();
  });

  it("スコープを止めたら、待ち中の更新は捨てる", async () => {
    const scope = effectScope();
    const source = ref(1);
    const debounced = scope.run(() => useDebouncedValue(source, 100))!;
    source.value = 2;
    await nextTick();
    scope.stop();
    vi.advanceTimersByTime(200);
    expect(debounced.value).toBe(1);
  });
});
