// src/composables/useSessionCheck.ts
// 画面を開きっぱなしのブラウザでも、別端末ログインによる強制ログアウトに
// 即座に気づけるよう定期的にログイン状態を確認する(旧 (admin)/layout.tsx から切り出し)。
// 実際の失効判定・メッセージ表示・リダイレクトは api/axios.ts のレスポンス
// インターセプター(SESSION_INVALIDATED 検知)が一元的に行うので、ここでは
// ただ /me を叩いて「次のリクエスト」を発生させるだけでよい。
//
// タブが裏に回っている間(別タブ・最小化・スリープ)は確認を止める。
// 開きっぱなしのタブが15秒ごとに叩き続けると、それだけでサイト全体の
// アクセスを上回ってしまうため。タブが表に戻った時点ですぐ1回確認し、
// その後また15秒ごとの確認を再開するので、強制ログアウトの検知は遅れない。
import { onScopeDispose } from "vue";
import axios from "axios";
import api from "@/api/axios";
import { hardRedirectHome, SESSION_EXPIRED_MESSAGE } from "@/lib/session";

export const SESSION_CHECK_INTERVAL_MS = 15_000;

export function useSessionCheck() {
  const checkSession = () => {
    api.get("/common/me").catch((e: unknown) => {
      // SESSION_INVALIDATED(別端末ログイン)は axios.ts 側で処理済み。
      // /common/me の通常の401(セッション切れ)は axios.ts では判定対象外なので、ここで処理する。
      if (axios.isAxiosError(e) && e.response?.status === 401) {
        hardRedirectHome(SESSION_EXPIRED_MESSAGE);
      }
      // それ以外の一時的な通信エラーでポーリング自体を止めたくないため、何もしない。
    });
  };

  let timer: ReturnType<typeof setInterval> | undefined;
  const start = () => {
    if (timer === undefined) {
      timer = setInterval(checkSession, SESSION_CHECK_INTERVAL_MS);
    }
  };
  const stop = () => {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      checkSession();
      start();
    } else {
      stop();
    }
  };

  if (document.visibilityState === "visible") start();
  document.addEventListener("visibilitychange", onVisibilityChange);

  onScopeDispose(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    stop();
  });
}
