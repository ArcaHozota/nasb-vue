// src/composables/usePlaylistCreation.ts
// YouTube プレイリスト作成の共通処理(賛美歌一覧・ランダム選択で共用)。
//  - 作成して完了まで待つ(進捗を progress に出す)
//  - 完了したら「YouTubeへ移動しますか」を確認する
//  - 409(未連携・再認証が必要)なら、個人設定へ移動するか確認する
//  - それ以外のエラーはトーストに出す
import { ref } from "vue";
import { useRouter } from "vue-router";
import {
  createPlaylistAndWait,
  getYoutubeReauthConfirmText,
  PlaylistError,
  type PlaylistTarget,
} from "@/lib/youtube";
import { extractErrorMessage } from "@/lib/constants";
import { useFeedbackStore } from "@/stores/feedback";

const YOUTUBE_PLAYLISTS_URL = "https://www.youtube.com/feed/playlists";

const isConflict = (e: unknown) =>
  !!e &&
  typeof e === "object" &&
  "response" in e &&
  (e as { response?: { status?: number } }).response?.status === 409;

export function usePlaylistCreation() {
  const router = useRouter();
  const feedback = useFeedbackStore();
  const creating = ref(false);
  const progress = ref("");

  /**
   * resolveTarget: 対象の曲(ID の一覧か、検索条件)を決める。対象が無いときは、自分でトーストを出して null を返す。
   * (決める途中の通信エラーも、プレイリスト作成のエラーと同じ扱いで表示される)
   */
  const create = async (
    resolveTarget: () => Promise<PlaylistTarget | null>,
  ) => {
    creating.value = true;
    try {
      const target = await resolveTarget();
      if (!target) return;
      if ("hymnIds" in target && target.hymnIds.length === 0) return;
      await createPlaylistAndWait(target, (st) => {
        progress.value = `${st.added}/${st.total}`;
      });
      const proceed = await feedback.confirm(
        "プレイリストを作成しました。今はYouTubeへ移動してよろしいでしょうか。",
        "お知らせ",
        { variant: "success", cancelLabel: "いいえ", confirmLabel: "はい" },
      );
      if (proceed) {
        window.open(YOUTUBE_PLAYLISTS_URL, "_blank", "noopener,noreferrer");
      }
    } catch (e: unknown) {
      if (isConflict(e)) {
        // 連携トークン失効・取り消し(再認証が必要)の場合は、専用文言で「はい／いいえ」を確認する
        const reauthText = getYoutubeReauthConfirmText(e);
        const ok = reauthText
          ? await feedback.confirm(reauthText, "確認", {
              cancelLabel: "いいえ",
              confirmLabel: "はい",
            })
          : await feedback.confirm(
              "YouTube連携がまだ完了していません。連携ページへ移動しますか？",
            );
        if (ok) await router.push("/personal");
        return;
      }
      feedback.toast(
        e instanceof PlaylistError
          ? e.message
          : extractErrorMessage(e, "プレイリスト作成に失敗しました"),
      );
    } finally {
      creating.value = false;
      progress.value = "";
    }
  };

  return { creating, progress, create };
}
