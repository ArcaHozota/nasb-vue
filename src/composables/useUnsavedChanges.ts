// src/composables/useUnsavedChanges.ts
// 編集内容があるあいだだけ、次の動作に対してブラウザ標準の確認を出す。
//  - タブ/ブラウザを閉じる、Ctrl+R などの再読み込み、アドレス欄から別サイトへ移動
// 画面内の移動(router-link / router.push)は beforeunload が動かないため、
// ルーターのガード(フェーズ3の AdminLayout)が useUnsavedGuard の dirty を見て確認を出す。
import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useUnsavedGuard } from "@/stores/unsavedGuard";

export function useUnsavedChanges(isDirty: MaybeRefOrGetter<boolean>) {
  const guard = useUnsavedGuard();

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (guard.bypass) return;
    e.preventDefault();
    // 古いブラウザ向け(文言は表示されず、ブラウザ標準の確認になる)
    e.returnValue = "";
  };

  watch(
    () => toValue(isDirty),
    (dirty) => {
      guard.setDirty(dirty);
      if (dirty) {
        window.addEventListener("beforeunload", onBeforeUnload);
      } else {
        window.removeEventListener("beforeunload", onBeforeUnload);
      }
    },
    { immediate: true },
  );

  // 画面(コンポーネント)を離れたら警告をやめ、dirty も落とす
  onScopeDispose(() => {
    window.removeEventListener("beforeunload", onBeforeUnload);
    guard.setDirty(false);
  });
}
