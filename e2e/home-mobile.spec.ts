import { expect, test, type Page } from "@playwright/test";
import { makeHymns, mockApi } from "./mock-api";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

/** 指でなぞる(CDP のタッチ入力。v-window の左右スワイプ・シートの取っ手を下へ) */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("モバイルホーム: 下までフリックで読み足し、曲を押すと詳細シート、左右スワイプで前後の曲", async ({ page }) => {
  await mockApi(page, { hymns: makeHymns(25) });
  await page.goto("/home");

  const list = page.getByRole("region", { name: "曲の一覧" });
  const rows = list.locator("[data-hymn-row]");
  await expect(rows.first()).toContainText("賛美歌1");
  // 管理画面はモバイルではログインできないので、ログインボタンは出さない
  await expect(page.getByRole("button", { name: "ログイン" })).toHaveCount(0);
  await expect(list.getByText("25件")).toHaveCount(0); // 件数は一覧の外(見出し)に出す
  await expect(page.getByText("25件", { exact: true })).toBeVisible();

  // 下までスクロールすると 10件ずつ読み足し、最後に「全25件を表示しました」
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(300);
  }
  await expect(rows).toHaveCount(25);
  await expect(page.getByText("全25件を表示しました")).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0 }));

  // 2曲目を押すと、下から詳細シート
  await rows.nth(1).click();
  const sheet = page.locator(".mobile-sheet__card");
  await expect(sheet.getByText("2 / 25")).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "賛美歌2" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "ト長調の楽譜をダウンロード" })).toBeVisible();
  // シートが下から上がりきるのを待つ(途中で触ると背景に当たる)
  await page.waitForTimeout(600);
  // シートは画面の高さの 88%
  const sheetBox = await sheet.boundingBox();
  expect(Math.round(sheetBox!.height)).toBe(Math.round(844 * 0.88));
  await page.screenshot({ path: process.env.MOBILE_SHOT ?? "test-results/home-mobile-sheet.png" });

  // 左へスワイプで次の曲、右へスワイプで前の曲
  await swipe(page, { x: 330, y: 600 }, { x: 40, y: 600 });
  await expect(sheet.getByText("3 / 25")).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "賛美歌3" })).toBeVisible();
  await swipe(page, { x: 40, y: 600 }, { x: 330, y: 600 });
  await expect(sheet.getByText("2 / 25")).toBeVisible();

  // 取っ手を下へスワイプで閉じる
  const head = await sheet.locator(".mobile-sheet__head").boundingBox();
  await swipe(page, { x: 195, y: head!.y + 10 }, { x: 195, y: head!.y + 200 });
  await expect(sheet).toBeHidden();
});

test("モバイルでログイン・管理画面のアドレスを直接開くと、理由を知らせてホームへ戻す", async ({ page }) => {
  await mockApi(page, { loggedIn: true, hymns: makeHymns(3) });
  for (const path of ["/login", "/hymns"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText("管理画面はPCからご利用ください。")).toBeVisible();
  }
  await expect(page.getByRole("textbox", { name: "パスワード" })).toHaveCount(0);
});
