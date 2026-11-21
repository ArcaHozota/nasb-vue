// src/composables/usePlaylistCreation.ts
// YouTube プレイリスト作成の共通処理(賛美歌一覧・ランダム選択で共用)。
//  - 作成して完了まで待つ(進捗を progress に出す)
//  - 完了したら「YouTubeへ移動しますか」を確認する
//  - 409(未連携・再認証が必要)なら、個人設定へ移動するか確認する
//  - それ以外のエラーはトーストに出す
//  - 作成中の状態は usePlaylistJob(ストア)で画面をまたいで持つ。作成中に画面を離れるときは確認し、
//    「OK」なら作成を中止する(router/guards.ts)。中止したあとは完了・失敗の通知を出さない
//  - 離れる確認を出している間に作成が終わっても、答えが出るまで完了の確認・エラーを出さない
import { ref } from "vue";
import { useRouter } from "vue-router";
import {
  createPlaylistAndWait,
  getYoutubeReauthConfirmText,
  PlaylistCancelled,
  PlaylistError,
  type PlaylistTarget,
} from "@/lib/youtube";
import { extractMessage } from "@/lib/constants";
import { useFeedbackStore } from "@/stores/feedback";
import { usePlaylistJob } from "@/stores/playlistJob";

const YOUTUBE_PLAYLISTS_URL = "https://www.youtube.com/feed/playlists";

const isConflict = (e: unknown) =>
  !!e &&
  typeof e === "object" &&
  "response" in e &&
  (e as { response?: { status?: number } }).response?.status === 409;

export function usePlaylistCreation() {
  const router = useRouter();
  const feedback = useFeedbackStore();
  const job = usePlaylistJob();
  const creating = ref(false);
  const progress = ref("");

  /**
   * resolveTarget: 対象の曲(ID の一覧か、検索条件)を決める。対象が無いときは、自分でトーストを出して null を返す。
   * (決める途中の通信エラーも、プレイリスト作成のエラーと同じ扱いで表示される)
   */
  const create = async (
    resolveTarget: () => Promise<PlaylistTarget | null>,
  ) => {
    // 作成は同時に1つだけ(別の画面で作成中のものも含む)
    if (job.active) {
      feedback.toast("プレイリストを作成中です。完了までお待ちください。");
      return;
    }
    creating.value = true;
    const signal = job.start();
    try {
      const target = await resolveTarget();
      if (!target) return;
      if ("hymnIds" in target && target.hymnIds.length === 0) return;
      await createPlaylistAndWait(
        target,
        (st) => {
          progress.value = `${st.added}/${st.total}`;
        },
        { signal, onStarted: job.setPlaylistId },
      );
      // 離れる確認を出している間に終わったら、答えが出るまで待つ。「OK」(中止して移動)なら何も出さない
      await job.waitUntilNotLeaving();
      if (job.cancelled) return;
      job.finish();
      const proceed = await feedback.confirm(
        "プレイリストを作成しました。今はYouTubeへ移動してよろしいでしょうか。",
        "お知らせ",
        { variant: "success" },
      );
      if (proceed) {
        window.open(YOUTUBE_PLAYLISTS_URL, "_blank", "noopener,noreferrer");
      }
    } catch (e: unknown) {
      await job.waitUntilNotLeaving();
      if (e instanceof PlaylistCancelled || job.cancelled) return;
      job.finish();
      if (isConflict(e)) {
        // 連携トークン失効・取り消し(再認証が必要)の場合は、専用文言で確認する
        const reauthText = getYoutubeReauthConfirmText(e);
        const ok = await feedback.confirm(
          reauthText ??
            "YouTube連携がまだ完了していません。連携ページへ移動しますか。",
          "お知らせ",
          { variant: "success" },
        );
        if (ok) await router.push("/personal");
        return;
      }
      feedback.toast(
        extractMessage(
          e instanceof PlaylistError ? e.message : e,
          "プレイリスト作成に失敗しました",
        ),
      );
    } finally {
      job.finish();
      creating.value = false;
      progress.value = "";
    }
  };

  return { creating, progress, create };
}
