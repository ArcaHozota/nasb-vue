import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { RouteLocationNormalized } from "vue-router";
import { confirmUnsaved, requireAuth } from "./guards";
import { useAuthStore } from "@/stores/auth";
import { useFeedbackStore } from "@/stores/feedback";
import { useUnsavedGuard } from "@/stores/unsavedGuard";

/** ガードに渡す最小限のルート */
const loc = (path: string, requiresAuth = false) =>
  ({
    path,
    matched: [{ meta: { requiresAuth } }],
  }) as unknown as RouteLocationNormalized;

// ガードは this も next も使わないので、引数だけ渡して呼ぶ
const runAuth = (to: RouteLocationNormalized) =>
  (requireAuth as (to: RouteLocationNormalized) => unknown)(to);
const runUnsaved = (to: RouteLocationNormalized, from: RouteLocationNormalized) =>
  (confirmUnsaved as (to: RouteLocationNormalized, from: RouteLocationNormalized) => unknown)(
    to,
    from,
  );

beforeEach(() => setActivePinia(createPinia()));

describe("requireAuth", () => {
  it("ログイン不要の画面はそのまま通す(ログイン確認もしない)", async () => {
    const auth = useAuthStore();
    auth.fetchMe = vi.fn();
    expect(await runAuth(loc("/home"))).toBe(true);
    expect(auth.fetchMe).not.toHaveBeenCalled();
  });

  it("ログイン済みならそのまま通す", async () => {
    const auth = useAuthStore();
    auth.user = { id: "1", username: "u", roles: [] };
    auth.fetchMe = vi.fn();
    expect(await runAuth(loc("/hymns", true))).toBe(true);
    expect(auth.fetchMe).not.toHaveBeenCalled();
  });

  it("未確認なら /me で確かめ、ログインしていれば通す", async () => {
    const auth = useAuthStore();
    auth.fetchMe = vi.fn(async () => {
      auth.user = { id: "1", username: "u", roles: [] };
      return auth.user;
    });
    expect(await runAuth(loc("/hymns", true))).toBe(true);
  });

  it("未ログイン(401)ならホームへ", async () => {
    const auth = useAuthStore();
    auth.fetchMe = vi.fn(async () => null);
    expect(await runAuth(loc("/hymns", true))).toEqual({ path: "/home", replace: true });
  });

  it("/me が想定外のエラーでもホームへ", async () => {
    const auth = useAuthStore();
    auth.fetchMe = vi.fn().mockRejectedValue(new Error("network"));
    expect(await runAuth(loc("/hymns", true))).toEqual({ path: "/home", replace: true });
  });
});

describe("confirmUnsaved", () => {
  it("編集中でなければ確認しない", async () => {
    const feedback = useFeedbackStore();
    feedback.confirm = vi.fn();
    expect(await runUnsaved(loc("/hymns"), loc("/books/add"))).toBe(true);
    expect(feedback.confirm).not.toHaveBeenCalled();
  });

  it("編集中に別の画面へ移るときは確認し、その答えに従う", async () => {
    useUnsavedGuard().setDirty(true);
    const feedback = useFeedbackStore();
    feedback.confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await runUnsaved(loc("/hymns"), loc("/books/add"))).toBe(false);
    expect(await runUnsaved(loc("/hymns"), loc("/books/add"))).toBe(true);
  });

  it("同じ画面(クエリだけ違う)への移動や、強制ログアウト中は確認しない", async () => {
    const guard = useUnsavedGuard();
    guard.setDirty(true);
    const feedback = useFeedbackStore();
    feedback.confirm = vi.fn();
    expect(await runUnsaved(loc("/books/add"), loc("/books/add"))).toBe(true);
    guard.setBypass();
    expect(await runUnsaved(loc("/hymns"), loc("/books/add"))).toBe(true);
    expect(feedback.confirm).not.toHaveBeenCalled();
  });
});
