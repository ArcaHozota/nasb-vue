// src/stores/feedback.ts
// トーストと確認ダイアログ。表示は FeedbackHost.vue(フェーズ3)が受け持ち、
// トーストは v-snackbar-queue、確認ダイアログは v-dialog で描画する。
import { defineStore } from "pinia";
import { ref } from "vue";
import { EMPTY_STRING } from "@/lib/constants";

/**
 * 確認ダイアログの色(タイトル・下線・OK ボタン)。
 *   primary(臙脂)  : 警告(ログアウト・削除)
 *   success(緑)    : お知らせ(編集の破棄・プレイリスト作成)
 *   secondary(青)  : 通知(上書き)
 */
export type DialogVariant = "primary" | "success" | "secondary";

export type DialogState = {
  show: boolean;
  title: string;
  text: string;
  variant: DialogVariant;
  cancelLabel: string;
  confirmLabel: string;
  resolve: ((ok: boolean) => void) | null;
  /** キャンセルのボタンを押したときだけ呼ぶ(Esc で閉じたときは呼ばない) */
  onCancel: (() => void) | null;
};

export type ConfirmOptions = {
  variant?: DialogVariant;
  cancelLabel?: string;
  confirmLabel?: string;
  /** キャンセルのボタンを押したときだけ行う処理(例: 楽譜の上書き確認の「考え」で既存の楽譜をダウンロード) */
  onCancel?: () => void;
};

/** v-snackbar-queue の v-model にそのまま渡せる形 */
export type ToastItem = { text: string; timeout: number };

/** 旧 MUI Snackbar の autoHideDuration={3000} に合わせる */
export const TOAST_TIMEOUT_MS = 3000;

const DEFAULT_DIALOG: DialogState = {
  show: false,
  title: "確認",
  text: EMPTY_STRING,
  variant: "primary",
  cancelLabel: "キャンセル",
  confirmLabel: "OK",
  resolve: null,
  onCancel: null,
};

export const useFeedbackStore = defineStore("feedback", () => {
  const dialog = ref<DialogState>({ ...DEFAULT_DIALOG });
  // v-snackbar-queue は表示した項目を配列から取り除いていく
  const toasts = ref<ToastItem[]>([]);

  // 旧 layer.msg(トースト)相当。呼び出し側の API(toast("..."))は従来通り。
  const toast = (text: string) => {
    toasts.value.push({ text, timeout: TOAST_TIMEOUT_MS });
  };

  // 旧 Swal.fire の confirm 相当。await confirm('...') で true/false が返る。
  // ボタンはアプリ全体で「キャンセル」「OK」に統一している。上書き確認だけは「考え」「OK」(cancelLabel)。
  const confirm = (
    text: string,
    title = "確認",
    options: ConfirmOptions = {},
  ) =>
    new Promise<boolean>((resolve) => {
      // 前のダイアログが未回答のまま次の confirm が来た場合は、前の方を false で閉じる
      dialog.value.resolve?.(false);
      dialog.value = {
        show: true,
        title,
        text,
        variant: options.variant ?? "primary",
        cancelLabel: options.cancelLabel ?? "キャンセル",
        confirmLabel: options.confirmLabel ?? "OK",
        resolve,
        onCancel: options.onCancel ?? null,
      };
    });

  const answer = (ok: boolean) => {
    const { resolve } = dialog.value;
    // ボタン押下と v-dialog の外側クリック等で2回呼ばれても、2回目は無視する。
    if (!resolve) return;
    resolve(ok);
    // タイトルや本文は残したまま show だけ落とす(閉じるアニメーション中に文言が消えないように)
    dialog.value = { ...dialog.value, show: false, resolve: null, onCancel: null };
  };

  /** キャンセルのボタン(Esc ではなく)を押したとき */
  const cancel = () => {
    if (!dialog.value.resolve) return;
    const { onCancel } = dialog.value;
    answer(false);
    onCancel?.();
  };

  return { dialog, toasts, toast, confirm, answer, cancel };
});
