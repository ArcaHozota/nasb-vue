import { expect, test } from "@playwright/test";
import { makeHymns, mockApi } from "./mock-api";

test.use({ viewport: { width: 1440, height: 900 } });

test("プレイリストの作成中に画面を離れると確認し、「戻る」なら残り、「OK」なら作成を中止して移動する", async ({
  page,
}) => {
  const api = await mockApi(page, {
    loggedIn: true,
    hymns: makeHymns(3),
    playlistRunning: true,
  });
  await page.goto("/hymns");
  await page.getByRole("button", { name: "プレイリスト作成" }).click();
  // 進捗の確認(playlist-status)が始まるまで待つ
  await expect
    .poll(
      () =>
        api.calls.filter((c) => c.path === "/youtube/playlist-status").length,
    )
    .toBeGreaterThan(0);

  const nav = page.getByRole("navigation").getByLabel("メニュー");
  const dialog = page.getByRole("alertdialog");
  const leaveText =
    "プレイリストを作成中です。移動すると作成を中止し、作りかけのプレイリストを削除します。移動しますか。";

  // 戻る: 画面に残り、作成(進捗の確認)を続ける
  await nav.getByText("ランダム検索").click();
  await expect(dialog).toContainText(leaveText);
  await expect(dialog).toContainText("お知らせ");
  // お知らせは「?」のアイコン(タイトルと同じ緑)。45〜52文字の本文は 0.8125rem
  await expect(dialog.locator(".feedback-dialog-body .v-icon")).toHaveAttribute(
    "data-icon",
    "mdi-help-circle-outline",
  );
  await expect(dialog.locator(".feedback-dialog-body .v-icon")).toHaveCSS("color", "rgb(53, 94, 59)");
  await expect(dialog.locator("#feedback-dialog-text")).toHaveCSS("font-size", "13px");
  await dialog.getByRole("button", { name: "戻る" }).click();
  await expect(page).toHaveURL(/\/hymns$/);
  const polls = api.calls.filter(
    (c) => c.path === "/youtube/playlist-status",
  ).length;
  await expect
    .poll(
      () =>
        api.calls.filter((c) => c.path === "/youtube/playlist-status").length,
    )
    .toBeGreaterThan(polls);

  // Esc も「戻る」と同じ
  await nav.getByText("ランダム検索").click();
  await expect(dialog).toContainText(leaveText);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/hymns$/);
  expect(api.calls.some((c) => c.path === "/youtube/cancel-playlist")).toBe(
    false,
  );

  // OK: 作成を中止して移動する
  await nav.getByText("ランダム検索").click();
  await dialog.getByRole("button", { name: "OK" }).click();
  await expect(page).toHaveURL(/\/hymns\/random-five/);
  await expect(
    page.getByText("プレイリストの作成を中止しました。"),
  ).toBeVisible();
  const cancels = api.calls.filter(
    (c) => c.path === "/youtube/cancel-playlist",
  );
  expect(cancels.map((c) => c.query)).toEqual([{ playlistId: "PL1" }]);

  // 中止したあとは進捗の確認をやめ、完了・失敗の通知も出さない。次の移動では確認しない
  const after = api.calls.filter(
    (c) => c.path === "/youtube/playlist-status",
  ).length;
  await page.waitForTimeout(2000);
  expect(
    api.calls.filter((c) => c.path === "/youtube/playlist-status").length,
  ).toBe(after);
  await nav.getByText("賛美歌一覧").click();
  await expect(page).toHaveURL(/\/hymns$/);
  await expect(dialog).toHaveCount(0);
});

test("作成中のログアウトは、先に「ログアウトしますか。」を聞き、やめたら作成を中止しない", async ({
  page,
}) => {
  const api = await mockApi(page, {
    loggedIn: true,
    hymns: makeHymns(3),
    playlistRunning: true,
  });
  await page.route("**/api/logout", (route) => route.fulfill({ status: 204 }));
  await page.goto("/hymns");
  await page.getByRole("button", { name: "プレイリスト作成" }).click();
  await expect
    .poll(() => api.calls.filter((c) => c.path === "/youtube/playlist-status").length)
    .toBeGreaterThan(0);

  const dialog = page.getByRole("alertdialog");
  const logout = page.getByRole("button", { name: "ログアウト", exact: true });
  const cancels = () => api.calls.filter((c) => c.path === "/youtube/cancel-playlist");

  // ログアウトをやめたら、作成は中止しない
  await logout.click();
  await expect(dialog).toContainText("ログアウトしますか。");
  await dialog.getByRole("button", { name: "戻る" }).click();
  await expect(page).toHaveURL(/\/hymns$/);
  await page.waitForTimeout(300);
  expect(cancels()).toEqual([]);

  // ログアウトする -> 作成の中止を確認 -> OK で中止してログアウト
  await logout.click();
  await dialog.getByRole("button", { name: "OK" }).click();
  await expect(dialog).toContainText("プレイリストを作成中です。");
  await dialog.getByRole("button", { name: "OK" }).click();
  await expect(page).toHaveURL(/\/home$/);
  expect(cancels().map((c) => c.query)).toEqual([{ playlistId: "PL1" }]);
});
