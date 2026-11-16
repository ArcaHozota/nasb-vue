import { expect, test } from "@playwright/test";
import { makeHymns, mockApi } from "./mock-api";

test.use({ viewport: { width: 1440, height: 900 } });

test("サイドバー: 紺地に項目を並べ(見出し・区切り線なし)、今の画面の項目を左の線で選択中にする", async ({ page }) => {
  await mockApi(page, { loggedIn: true, hymns: makeHymns(3) });
  await page.goto("/hymns");

  const nav = page.getByRole("navigation").getByLabel("メニュー");
  for (const t of ["聖書章節選択", "聖書章節入力", "賛美歌一覧", "ランダム検索", "レシート明細入力"]) {
    await expect(nav.getByText(t, { exact: true })).toBeVisible();
  }
  // 見出し・区切り線は置かない
  await expect(nav.locator(".v-list-subheader, .v-divider")).toHaveCount(0);
  const current = nav.locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toContainText("賛美歌一覧");
  // 背景は紺(#0F172A)、選択中は少し明るい背景(#1E293B)
  await expect(page.locator(".admin-sidebar")).toHaveCSS("background-color", "rgb(15, 23, 42)");
  await expect(current).toHaveCSS("background-color", "rgb(30, 41, 59)");
  // 画面の見出しバーも選択中と同じ #1E293B
  await expect(page.locator(".hymn-list__header")).toHaveCSS("background-color", "rgb(30, 41, 59)");
  // 選択中は左端に臙脂の線(3px)
  await expect(current).toHaveCSS("border-left-color", "rgb(196, 60, 90)");
  await expect(current).toHaveCSS("border-left-width", "3px");
  // ロゴはエルサレム十字(共通の部品。紺地の上なのでクリーム色)
  await expect(page.locator(".admin-brand .jerusalem-cross")).toBeVisible();
  await expect(page.locator(".admin-brand .jerusalem-cross")).toHaveCSS("color", "rgb(243, 227, 195)");
  await page.screenshot({ path: process.env.SIDEBAR_SHOT ?? "test-results/sidebar.png" });

  // 押すとその画面へ移り、選択中も移る
  await nav.getByText("ランダム検索").click();
  await expect(page).toHaveURL(/\/hymns\/random-five/);
  await expect(nav.locator('[aria-current="page"]')).toContainText("ランダム検索");
});
