// src/stores/feedback.ts
import { reactive } from "vue";
import { defineStore } from "pinia";
import { EMPTY_STRING } from "@/constants";

type SnackbarState = {
  show: boolean;
  text: string;
};

type DialogState = {
  show: boolean;
  title: string;
  text: string;
  resolve: ((ok: boolean) => void) | null;
};

export const useFeedbackStore = defineStore("feedback", () => {
  const snackbar = reactive<SnackbarState>({
    show: false,
    text: EMPTY_STRING,
  });
  const dialog = reactive<DialogState>({
    show: false,
    title: "確認",
    text: EMPTY_STRING,
    resolve: null,
  });

  // 旧 layer.msg(トースト)相当。MUI Snackbarの autoHideDuration={3000} に合わせ、
  // 3秒後に自動で閉じる。
  const toast = (text: string): void => {
    snackbar.show = true;
    snackbar.text = text;
    setTimeout(closeSnackbar, 3000);
  };

  const closeSnackbar = (): void => {
    snackbar.show = false;
  };

  // 旧 Swal.fire の confirm 相当。await confirm('...') で true/false が返る
  const confirm = (text: string, title = "確認"): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      dialog.show = true;
      dialog.title = title;
      dialog.text = text;
      dialog.resolve = resolve;
    });

  const answer = (ok: boolean): void => {
    dialog.resolve?.(ok);
    dialog.show = false;
    dialog.title = "確認";
    dialog.text = EMPTY_STRING;
    dialog.resolve = null;
  };

  return { snackbar, dialog, toast, closeSnackbar, confirm, answer };
});
