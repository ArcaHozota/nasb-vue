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
    vi.stubGlobal("window", { open: vi.fn() });
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
});
