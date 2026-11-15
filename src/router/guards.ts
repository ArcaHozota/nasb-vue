// src/router/guards.ts
// ルーターの全体ガード。旧 (admin)/layout.tsx に分散していた処理をここに集める。
//  - requireAuth   : meta.requiresAuth の画面は、ログインを確認してから表示する(未ログインならホームへ)
//  - confirmUnsaved: 編集中の内容があるまま画面内を移動するとき、先に確認する
//  - blockOnMobile : meta.pcOnly の画面(ログイン・管理画面)は、モバイルの幅では開かせずホームへ戻す
import type {
  NavigationGuardWithThis,
  RouteLocationNormalized,
} from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useFeedbackStore } from "@/stores/feedback";
import { useUnsavedGuard } from "@/stores/unsavedGuard";
import { MOBILE_BREAKPOINT } from "@/composables/useIsMobile";

declare module "vue-router" {
  interface RouteMeta {
    /** ログインが必要な画面(AdminLayout 配下) */
    requiresAuth?: boolean;
    /** PC でだけ開ける画面(ログイン・管理画面)。モバイルの幅ではホームへ戻す */
    pcOnly?: boolean;
  }
}

/** モバイル(幅 768px 未満。サイドバー・ホームの切り替えと同じ境目)では管理画面を使わせない、という案内 */
export const PC_ONLY_MESSAGE = "管理画面はPCからご利用ください。";

/**
 * 管理画面はモバイルではログインできない仕様。meta.pcOnly の画面をモバイルの幅で開こうとしたら、
 * 理由をトーストで知らせてホームへ戻す。
 * (画面側だけの制限。PC 用表示や窓の幅を変えれば通れるので、安全上の制限ではない)
 */
export const blockOnMobile: NavigationGuardWithThis<undefined> = (to) => {
  if (!to.matched.some((r) => r.meta.pcOnly)) return true;
  if (window.innerWidth >= MOBILE_BREAKPOINT) return true;
  useFeedbackStore().toast(PC_ONLY_MESSAGE);
  return { path: "/home", replace: true };
};

export const requireAuth: NavigationGuardWithThis<undefined> = async (to) => {
  if (!to.matched.some((r) => r.meta.requiresAuth)) return true;
  const auth = useAuthStore();
  if (!auth.isLoggedIn) {
    try {
      await auth.fetchMe();
    } catch {
      // 401以外の予期しないエラー。ひとまずホームへ逃がす。
      return { path: "/home", replace: true };
    }
  }
  // fetchMe() は401時に例外を投げず user=null を返すので、改めて確認する
  return auth.isLoggedIn ? true : { path: "/home", replace: true };
};

/** 同じ画面(パスが同じでクエリだけ違う)への移動は確認しない */
const isSamePage = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
) => to.path === from.path;

/** 未保存の内容を破棄してよいか確認する(ログアウト前など、ルーター外からも使う) */
export async function confirmDiscardUnsaved(): Promise<boolean> {
  const guard = useUnsavedGuard();
  if (!guard.dirty || guard.bypass) return true;
  return useFeedbackStore().confirm(
    "編集中の内容があります。破棄して移動しますか？",
    "お知らせ",
    { variant: "success" },
  );
}

export const confirmUnsaved: NavigationGuardWithThis<undefined> = async (
  to,
  from,
) => {
  if (isSamePage(to, from)) return true;
  // false を返すと移動を取り消す(ブラウザの「戻る」でも URL は元に戻る)
  return confirmDiscardUnsaved();
};
