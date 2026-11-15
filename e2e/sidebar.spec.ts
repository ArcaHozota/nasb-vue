import { expect, test } from "@playwright/test";
import { makeHymns, mockApi } from "./mock-api";

test.use({ viewport: { width: 1440, height: 900 } });

test("サイドバー: 見出しごとに項目を並べ、今の画面の項目を選択中にする", async ({ page }) => {
  await mockApi(page, { loggedIn: true, hymns: makeHymns(3) });
  await page.goto("/hymns");

  const nav = page.getByRole("navigation").getByLabel("メニュー");
  for (const g of ["聖書", "賛美歌", "その他"]) {
    await expect(nav.getByText(g, { exact: true })).toBeVisible();
  }
  const current = nav.locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toContainText("賛美歌一覧");
  // ロゴの画像が読み込まれてから撮る
  await expect
    .poll(() => page.locator(".admin-brand__logo").evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await page.screenshot({ path: process.env.SIDEBAR_SHOT ?? "test-results/sidebar.png" });

  // 押すとその画面へ移り、選択中も移る
  await nav.getByText("ランダム検索").click();
  await expect(page).toHaveURL(/\/hymns\/random-five/);
  await expect(nav.locator('[aria-current="page"]')).toContainText("ランダム検索");
});
