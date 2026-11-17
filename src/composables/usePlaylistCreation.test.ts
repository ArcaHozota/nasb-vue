import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const { push, createPlaylistAndWait } = vi.hoisted(() => ({
  push: vi.fn(),
  createPlaylistAndWait: vi.fn(),
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/youtube", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/youtube")>()),
  createPlaylistAndWait,
}));

import { usePlaylistCreation } from "./usePlaylistCreation";
import { useFeedbackStore } from "@/stores/feedback";
import { PlaylistError } from "@/lib/youtube";
import { usePlaylistJob } from "@/stores/playlistJob";

/** confirm を、決まった答えを返す関数に差し替える */
const answerConfirm = (ok: boolean) => {
  const feedback = useFeedbackStore();
  const confirm = vi.fn().mockResolvedValue(ok);
  feedback.confirm = confirm;
  return confirm;
};

describe("usePlaylistCreation", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    push.mockReset();
    createPlaylistAndWait.mockReset();
    vi.stubGlobal("window", {
      open: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it("作成中は creating/progress を更新し、完了後に YouTube へ移動するか確認する", async () => {
    const confirm = answerConfirm(true);
    const pc = usePlaylistCreation();
    createPlaylistAndWait.mockImplementation(async (_t, onProgress) => {
      expect(pc.creating.value).toBe(true);
      onProgress({ added: 1, total: 3 });
      expect(pc.progress.value).toBe("1/3");
    });

    await pc.create(async () => ({ hymnIds: ["1", "2", "3"] }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith(
      "https://www.youtube.com/feed/playlists",
      "_blank",
      "noopener,noreferrer",
    );
    expect(pc.creating.value).toBe(false);
    expect(pc.progress.value).toBe("");
  });

  it("対象が無い・空なら何もしない", async () => {
    const pc = usePlaylistCreation();
    await pc.create(async () => null);
    await pc.create(async () => ({ hymnIds: [] }));
    expect(createPlaylistAndWait).not.toHaveBeenCalled();
  });

  it("409(未連携)なら、確認のうえ個人設定へ移動する", async () => {
    answerConfirm(true);
    createPlaylistAndWait.mockRejectedValue({
      response: { status: 409, data: {} },
    });

    await usePlaylistCreation().create(async () => ({ keyword: "愛" }));

    expect(push).toHaveBeenCalledWith("/personal");
  });

  it("その他のエラーはトーストに出す", async () => {
    createPlaylistAndWait.mockRejectedValue(
      new PlaylistError("上限を超えました"),
    );
    await usePlaylistCreation().create(async () => ({ keyword: "愛" }));
    expect(useFeedbackStore().toasts.map((t) => t.text)).toEqual([
      "上限を超えました",
    ]);
  });

  it("作成中にもう一度押しても、2つ目は始めない(別の画面で作成中のものも含む)", async () => {
    answerConfirm(false);
    let finish!: () => void;
    createPlaylistAndWait.mockImplementation(
      () => new Promise<void>((r) => (finish = r)),
    );
    const first = usePlaylistCreation().create(async () => ({ keyword: "愛" }));
    await vi.waitFor(() => expect(createPlaylistAndWait).toHaveBeenCalled());

    await usePlaylistCreation().create(async () => ({ keyword: "望" }));
    expect(createPlaylistAndWait).toHaveBeenCalledTimes(1);
    expect(useFeedbackStore().toasts.map((t) => t.text)).toEqual([
      "プレイリストを作成中です。完了までお待ちください。",
    ]);
    finish();
    await first;
    expect(usePlaylistJob().active).toBe(false);
  });

  it("離れる確認を出している間に完了したら、答えが出るまで完了の確認を出さない。「OK」(中止して移動)なら出さない", async () => {
    const confirm = answerConfirm(true);
    const job = usePlaylistJob();
    createPlaylistAndWait.mockImplementation(async () => {
      job.leaving = true; // 完了したときに、ちょうど離れる確認が出ている
    });
    const done = usePlaylistCreation().create(async () => ({ keyword: "愛" }));
    await vi.waitFor(() => expect(createPlaylistAndWait).toHaveBeenCalled());
    await Promise.resolve();
    expect(confirm).not.toHaveBeenCalled(); // 確認ダイアログを上書きしない

    job.cancelled = true; // 「OK」で中止した
    job.leaving = false;
    await done;
    expect(confirm).not.toHaveBeenCalled();
    expect(job.active).toBe(false);
  });

  it("離れる確認で「戻る」なら、そのあとで完了の確認を出す", async () => {
    const confirm = answerConfirm(false);
    const job = usePlaylistJob();
    createPlaylistAndWait.mockImplementation(async () => {
      job.leaving = true;
    });
    const done = usePlaylistCreation().create(async () => ({ keyword: "愛" }));
    await vi.waitFor(() => expect(createPlaylistAndWait).toHaveBeenCalled());
    expect(confirm).not.toHaveBeenCalled();

    job.leaving = false; // 「戻る」
    await done;
    expect(confirm).toHaveBeenCalledWith(
      "プレイリストを作成しました。今はYouTubeへ移動してよろしいでしょうか。",
      "お知らせ",
      { variant: "success" },
    );
  });

  it("中止したら、失敗のトーストも出さない", async () => {
    const job = usePlaylistJob();
    createPlaylistAndWait.mockImplementation(async () => {
      job.cancelled = true;
      throw new Error("canceled");
    });
    await usePlaylistCreation().create(async () => ({ keyword: "愛" }));
    expect(useFeedbackStore().toasts).toEqual([]);
  });
});
