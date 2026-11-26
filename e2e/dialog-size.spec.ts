import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

// アプリの確認ダイアログの文言(と、長い曲名を入れた削除の確認)
const texts = [
  "ログアウトしますか。",
  "編集中の内容があります。破棄して移動しますか。",
  "この「賛美歌11」という歌の情報を削除してもよろしいですか。",
  "この「主よ、み手もて引かせたまえ ただわが主の道を歩まん」という歌の情報を削除してもよろしいですか。",
  "プレイリストを作成中です。移動すると作成を中止し、作りかけのプレイリストを削除します。移動しますか。",
  "YouTube連携を解除しますか。プレイリストを作成するには、もう一度連携が必要です。",
  "既存の節かどうか確認できませんでした。既に登録されている場合は上書きされます。保存しますか。",
  "Genesis 1:1 は既に登録されています。入力した内容で上書きして更新しますか。",
  "A♭の楽譜は登録済みです。上書きしますか。",
  "変更を破棄して閉じますか。",
  "YouTube連携がまだ完了していません。連携ページへ移動しますか。",
  "プレイリストを作成しました。今はYouTubeへ移動してよろしいでしょうか。",
  "YouTube連携の再認証が必要です。今は個人情報画面へ移動していいですか。",
];

test("確認ダイアログは幅363px・高さ225pxで固定し、アイコンは36px。どの文言も本文の欄に収まり、文字の大きさだけが変わる", async ({
  page,
}) => {
  await mockApi(page, { loggedIn: true });
  await page.goto("/mainmenu");
  for (const text of texts) {
    // 画面の操作を経ずに、アプリの通知ストア(Pinia)から直接ダイアログを出す
    await page.evaluate((t) => {
      const app = (document.querySelector("#app") as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, { confirm: (text: string, title: string) => Promise<boolean> }> } } } };
      }).__vue_app__;
      void app.config.globalProperties.$pinia._s.get("feedback")!.confirm(t, "お知らせ");
    }, text);
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.locator("#feedback-dialog-text")).toHaveText(text);
    const card = dialog.locator(".v-card");
    await expect.poll(async () => {
      const b = (await card.boundingBox())!;
      return [Math.round(b.width), Math.round(b.height)];
    }).toEqual([363, 225]);
    const icon = (await dialog.locator(".feedback-dialog-icon").boundingBox())!;
    expect([Math.round(icon.width), Math.round(icon.height)]).toEqual([36, 36]);
    const overflow = await dialog
      .locator(".feedback-dialog-main")
      .evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(overflow, text).toBeLessThanOrEqual(0);
    await dialog.getByRole("button", { name: "戻る" }).click();
    await expect(dialog).toHaveCount(0);
  }
});
