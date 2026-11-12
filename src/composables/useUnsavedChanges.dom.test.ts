// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useUnsavedChanges } from "./useUnsavedChanges";
import { useUnsavedGuard } from "@/stores/unsavedGuard";

/** beforeunload を発火し、ブラウザの確認が出る(=preventDefault された)かを返す */
const fireBeforeUnload = () => {
  const e = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
};

describe("useUnsavedChanges", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("編集中だけ dirty を立て、離脱の確認を出す", async () => {
    const scope = effectScope();
    const dirty = ref(false);
    scope.run(() => useUnsavedChanges(dirty));
    const guard = useUnsavedGuard();

    expect(guard.dirty).toBe(false);
    expect(fireBeforeUnload()).toBe(false);

    dirty.value = true;
    await nextTick();
    expect(guard.dirty).toBe(true);
    expect(fireBeforeUnload()).toBe(true);

    dirty.value = false;
    await nextTick();
    expect(guard.dirty).toBe(false);
    expect(fireBeforeUnload()).toBe(false);
    scope.stop();
  });

  it("bypass が立っていたら確認を出さない(強制ログアウト時など)", () => {
    const scope = effectScope();
    scope.run(() => useUnsavedChanges(true));
    useUnsavedGuard().setBypass();
    expect(fireBeforeUnload()).toBe(false);
    scope.stop();
  });

  it("画面を離れたら確認をやめ、dirty も落とす", () => {
    const scope = effectScope();
    scope.run(() => useUnsavedChanges(true));
    expect(useUnsavedGuard().dirty).toBe(true);

    scope.stop();
    expect(useUnsavedGuard().dirty).toBe(false);
    expect(fireBeforeUnload()).toBe(false);
  });
});
