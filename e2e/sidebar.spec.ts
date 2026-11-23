import { expect, test } from "@playwright/test";
import { makeHymns, mockApi } from "./mock-api";

test.use({ viewport: { width: 1440, height: 900 } });

test("管理画面のナビゲーションは淡い青地に臙脂色で、現在の画面を示す", async ({ page }) => {
  await mockApi(page, { loggedIn: true, hymns: makeHymns(3) });
  await page.goto("/hymns");

  const nav = page.getByRole("navigation").getByLabel("メニュー");
  for (const t of ["聖書章節選択", "聖書章節入力", "賛美歌一覧", "ランダム検索", "レシート明細入力"]) {
    const label = nav.getByText(t, { exact: true });
    await expect(label).toBeVisible();
    await expect(label).toHaveCSS("color", "rgb(128, 0, 32)");
  }
  // 見出し・区切り線は置かない
  await expect(nav.locator(".v-list-subheader, .v-divider")).toHaveCount(0);
  const current = nav.locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toContainText("賛美歌一覧");
  await expect(page.locator(".admin-sidebar")).toHaveCSS("background-color", "rgb(242, 245, 253)");
  const bar = page.locator(".admin-bar");
  await expect(bar).toHaveCSS("background-color", "rgb(242, 245, 253)");
  await expect(bar.getByRole("button", { name: "ログアウト", exact: true })).toHaveCSS("color", "rgb(128, 0, 32)");
  await expect(current).toHaveCSS("background-color", "rgb(214, 225, 251)");
  const title = page.getByRole("heading", { name: "賛美歌情報メンテナンス" });
  await expect(title.locator("..")).toHaveCSS("background-color", "rgb(53, 53, 66)");
  await expect(title).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(title).toHaveCSS("font-weight", "700");
  // 選択中は左端に臙脂の線(3px)
  await expect(current).toHaveCSS("border-left-color", "rgb(128, 0, 32)");
  await expect(current).toHaveCSS("border-left-width", "3px");
  // ロゴのエルサレム十字と文字も primary。
  await expect(page.locator(".admin-brand .jerusalem-cross")).toBeVisible();
  await expect(page.locator(".admin-brand .jerusalem-cross")).toHaveCSS("color", "rgb(128, 0, 32)");
  await expect(page.locator(".admin-brand__title")).toHaveCSS("color", "rgb(128, 0, 32)");
  await page.screenshot({ path: process.env.SIDEBAR_SHOT ?? "test-results/sidebar.png" });

  // 押すとその画面へ移り、選択中も移る
  await nav.getByText("ランダム検索").click();
  await expect(page).toHaveURL(/\/hymns\/random-five/);
  await expect(nav.locator('[aria-current="page"]')).toContainText("ランダム検索");
});
