// src/stores/playlistJob.ts
// 作成中の YouTube プレイリストを、画面をまたいで管理するストア。
//  - 作成中(active)は、画面内の移動・ログアウトの前に確認する(confirmLeavePlaylist。router/guards.ts から呼ぶ)
//  - 「OK」で移動するときは、進捗の確認を止め(AbortController)、サーバーに作成の中止を頼む
//    (POST /youtube/cancel-playlist。サーバーは次の動画の前で止め、作りかけのプレイリストを削除する)
//  - 作成を受け付けてもらう前(playlistId がまだ無い)に中止したときは、受け付けられた直後に中止を頼む
//  - タブを閉じる・再読み込みはブラウザ標準の確認を出し、実際にページを離れたら keepalive の通信で中止を頼む
//  - 確認ダイアログを出している間(leaving)に作成が終わっても、完了の確認でそのダイアログを上書きしない
//    (usePlaylistCreation が waitUntilNotLeaving で、答えが出るまで待つ)
import { defineStore } from "pinia";
import { ref, watch } from "vue";
import api from "@/api/axios";
import { useCsrfStore } from "@/stores/csrf";
import { useFeedbackStore } from "@/stores/feedback";
import { useUnsavedGuard } from "@/stores/unsavedGuard";
import type { PlaylistStatus } from "@/lib/youtube";

export const PLAYLIST_LEAVE_CONFIRM_TEXT =
  "プレイリストを作成中です。移動すると作成を中止し、作りかけのプレイリストを削除します。移動しますか？";

export const usePlaylistJob = defineStore("playlistJob", () => {
  const feedback = useFeedbackStore();
  /** 作成中(作成を始めてから、完了・失敗・中止の処理が終わるまで) */
  const active = ref(false);
  /** サーバーが作成を受け付けたプレイリストの ID(受け付け前は null) */
  const playlistId = ref<string | null>(null);
  /** 中止した(以後の進捗・完了・失敗の通知は出さない) */
  const cancelled = ref(false);
  /** 画面を離れてよいかの確認ダイアログを出している間 true */
  const leaving = ref(false);
  let controller: AbortController | null = null;

  /** 作成を始める。進捗の確認を止めるための signal を返す */
  const start = (): AbortSignal => {
    active.value = true;
    playlistId.value = null;
    cancelled.value = false;
    controller = new AbortController();
    return controller.signal;
  };

  /** 作成を受け付けてもらったとき。その前に中止していたら、ここでサーバーに中止を頼む */
  const setPlaylistId = (id: string) => {
    playlistId.value = id;
    if (cancelled.value) void requestCancel(id);
  };

  /** 作成の処理(完了・失敗・中止)が終わったとき */
  const finish = () => {
    active.value = false;
    playlistId.value = null;
    controller = null;
  };

  const requestCancel = async (id: string) => {
    try {
      const { data } = await api.post<PlaylistStatus>(
        "/youtube/cancel-playlist",
        null,
        { params: { playlistId: id } },
      );
      feedback.toast(
        data.state === "done"
          ? "プレイリストの作成はすでに完了していたため、中止しませんでした。"
          : "プレイリストの作成を中止しました。",
      );
    } catch {
      // 見つからない(期限切れ・サーバー再起動)などは、知らせるだけにする
      feedback.toast("プレイリストの作成を中止できませんでした。");
    }
  };

  /** 作成を中止する(進捗の確認を止め、サーバーに中止を頼む) */
  const cancel = async () => {
    cancelled.value = true;
    controller?.abort();
    if (playlistId.value) await requestCancel(playlistId.value);
  };

  /** 中止していない作成中のときだけ、離れる前の確認が要る */
  const needsLeaveConfirm = () => active.value && !cancelled.value;

  /** 確認ダイアログの答えが出るまで待つ(出していなければすぐ戻る) */
  const waitUntilNotLeaving = () =>
    new Promise<void>((resolve) => {
      if (!leaving.value) return resolve();
      const stop = watch(leaving, (v) => {
        if (v) return;
        stop();
        resolve();
      });
    });

  // ===== タブを閉じる・再読み込み =====
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!needsLeaveConfirm() || useUnsavedGuard().bypass) return;
    e.preventDefault();
    // 古いブラウザ向け(文言は表示されず、ブラウザ標準の確認になる)
    e.returnValue = "";
  };
  // 実際にページを離れるときは、ページが閉じても届く keepalive の通信で中止を頼む
  // (受け付け前で playlistId が無いときは頼めない。その作成はサーバーで最後まで進む)
  const onPageHide = () => {
    if (!needsLeaveConfirm() || !playlistId.value) return;
    const csrf = useCsrfStore();
    void fetch(
      `/api/youtube/cancel-playlist?playlistId=${encodeURIComponent(playlistId.value)}`,
      {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: { [csrf.headerName()]: csrf.tokenValue() },
      },
    ).catch(() => {});
  };
  watch(active, (on) => {
    if (typeof window === "undefined") return; // ユニットテスト(Node)など
    if (on) {
      window.addEventListener("beforeunload", onBeforeUnload);
      window.addEventListener("pagehide", onPageHide);
    } else {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    }
  });

  return {
    active,
    playlistId,
    cancelled,
    leaving,
    start,
    setPlaylistId,
    finish,
    cancel,
    needsLeaveConfirm,
    waitUntilNotLeaving,
  };
});

/**
 * プレイリストの作成中なら、画面を離れてよいか確認する(画面内の移動・ログアウトの前)。
 *   戻る/Esc: 画面に残り、作成と進捗の表示を続ける(false)
 *   OK      : 作成を中止して移動する(true)
 */
export async function confirmLeavePlaylist(): Promise<boolean> {
  const job = usePlaylistJob();
  if (!job.needsLeaveConfirm()) return true;
  job.leaving = true;
  try {
    const ok = await useFeedbackStore().confirm(
      PLAYLIST_LEAVE_CONFIRM_TEXT,
      "お知らせ",
      { variant: "success" },
    );
    if (ok) await job.cancel();
    return ok;
  } finally {
    job.leaving = false;
  }
}
