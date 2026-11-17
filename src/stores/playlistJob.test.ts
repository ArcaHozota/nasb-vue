import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/api/axios", () => ({ default: { post } }));

import {
  confirmLeavePlaylist,
  PLAYLIST_LEAVE_CONFIRM_TEXT,
  usePlaylistJob,
} from "./playlistJob";
import { useFeedbackStore } from "./feedback";

/** confirm を、決まった答えを返す関数に差し替える */
const answerConfirm = (ok: boolean) => {
  const confirm = vi.fn().mockResolvedValue(ok);
  useFeedbackStore().confirm = confirm;
  return confirm;
};
const toasts = () => useFeedbackStore().toasts.map((t) => t.text);

describe("confirmLeavePlaylist", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    post.mockReset();
    post.mockResolvedValue({ data: { state: "cancelled" } });
  });

  it("作成中でなければ確認せずに通す", async () => {
    const confirm = answerConfirm(true);
    expect(await confirmLeavePlaylist()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("作成中に「戻る」なら残る(作成も進捗の確認も続ける)", async () => {
    const confirm = answerConfirm(false);
    const job = usePlaylistJob();
    const signal = job.start();
    job.setPlaylistId("PL1");

    expect(await confirmLeavePlaylist()).toBe(false);
    expect(confirm).toHaveBeenCalledWith(
      PLAYLIST_LEAVE_CONFIRM_TEXT,
      "お知らせ",
      { variant: "success" },
    );
    expect(signal.aborted).toBe(false);
    expect(post).not.toHaveBeenCalled();
    expect(job.leaving).toBe(false);
  });

  it("作成中に「OK」なら、進捗の確認を止めてサーバーに中止を頼む", async () => {
    answerConfirm(true);
    const job = usePlaylistJob();
    const signal = job.start();
    job.setPlaylistId("PL1");

    expect(await confirmLeavePlaylist()).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(post).toHaveBeenCalledWith("/youtube/cancel-playlist", null, {
      params: { playlistId: "PL1" },
    });
    expect(toasts()).toEqual(["プレイリストの作成を中止しました。"]);
    // 中止したあとは、もう確認しない
    expect(job.needsLeaveConfirm()).toBe(false);
  });

  it("受け付け前に中止したら、受け付けられた直後に中止を頼む", async () => {
    answerConfirm(true);
    const job = usePlaylistJob();
    job.start();

    expect(await confirmLeavePlaylist()).toBe(true);
    expect(post).not.toHaveBeenCalled();
    job.setPlaylistId("PL2");
    expect(post).toHaveBeenCalledWith("/youtube/cancel-playlist", null, {
      params: { playlistId: "PL2" },
    });
  });

  it("中止が間に合わず完了していたら、その旨を知らせる(完了したプレイリストは消えない)", async () => {
    answerConfirm(true);
    post.mockResolvedValue({ data: { state: "done" } });
    const job = usePlaylistJob();
    job.start();
    job.setPlaylistId("PL1");

    await confirmLeavePlaylist();
    expect(toasts()).toEqual([
      "プレイリストの作成はすでに完了していたため、中止しませんでした。",
    ]);
  });

  it("中止を頼めなかったら知らせる(移動はする)", async () => {
    answerConfirm(true);
    post.mockRejectedValue({ response: { status: 404, data: "" } });
    const job = usePlaylistJob();
    job.start();
    job.setPlaylistId("PL1");

    expect(await confirmLeavePlaylist()).toBe(true);
    expect(toasts()).toEqual(["プレイリストの作成を中止できませんでした。"]);
  });
});
