import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useFeedbackStore } from "./feedback";

beforeEach(() => setActivePinia(createPinia()));

describe("確認ダイアログ", () => {
  it("ボタンの文言は既定で「キャンセル」「OK」", () => {
    const feedback = useFeedbackStore();
    void feedback.confirm("本文", "警告");
    expect(feedback.dialog).toMatchObject({
      show: true,
      title: "警告",
      cancelLabel: "キャンセル",
      confirmLabel: "OK",
      variant: "primary",
    });
  });

  it("OK なら true", async () => {
    const feedback = useFeedbackStore();
    const p = feedback.confirm("本文");
    feedback.answer(true);
    await expect(p).resolves.toBe(true);
    expect(feedback.dialog.show).toBe(false);
  });

  it("キャンセルのボタンなら false を返し、onCancel を呼ぶ", async () => {
    const feedback = useFeedbackStore();
    const onCancel = vi.fn();
    const p = feedback.confirm("上書きしますか？", "通知", {
      variant: "secondary",
      cancelLabel: "考え",
      onCancel,
    });
    expect(feedback.dialog.cancelLabel).toBe("考え");
    feedback.cancel();
    await expect(p).resolves.toBe(false);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Esc(answer(false))では onCancel を呼ばない", async () => {
    const feedback = useFeedbackStore();
    const onCancel = vi.fn();
    const p = feedback.confirm("上書きしますか？", "通知", { onCancel });
    feedback.answer(false);
    await expect(p).resolves.toBe(false);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("回答済みのあとに押されても、2回目は無視する", async () => {
    const feedback = useFeedbackStore();
    const onCancel = vi.fn();
    const p = feedback.confirm("本文", "通知", { onCancel });
    feedback.answer(true);
    feedback.cancel();
    await expect(p).resolves.toBe(true);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
