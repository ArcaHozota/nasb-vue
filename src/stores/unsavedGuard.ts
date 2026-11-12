// src/stores/unsavedGuard.ts
// 「未保存の編集内容があるか」を画面をまたいで共有するストア。
//  - dirty : 編集内容がある間 true(useUnsavedChanges が更新する)
//  - bypass: true の間は離脱の警告を出さない(別端末ログインによる強制ログアウトなど、
//            ユーザー操作ではないページ遷移の直前に立てる)
import { defineStore } from "pinia";
import { ref } from "vue";

export const useUnsavedGuard = defineStore("unsavedGuard", () => {
  const dirty = ref(false);
  const bypass = ref(false);

  const setDirty = (value: boolean) => {
    dirty.value = value;
  };
  const setBypass = () => {
    bypass.value = true;
  };

  return { dirty, bypass, setDirty, setBypass };
});
