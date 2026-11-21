import { expect, test } from "@playwright/test";
import { makeHymns, mockApi } from "./mock-api";

test.use({ viewport: { width: 1440, height: 900 } });

test("トースト: 背景はテーマの info、文字は白の Noto Serif JP 太字で中央揃え", async ({ page }) => {
  await mockApi(page, { loggedIn: true, hymns: makeHymns(1) });
  await page.goto("/mainmenu");
  // 未実装の項目はトーストで知らせる(明朝体を使わないメインメニューでも同じ書体で出す)
  await page.getByRole("navigation").getByLabel("メニュー").getByText("聖書章節選択").click();

  const content = page.locator(".app-toast .v-snackbar__content");
  await expect(content).toBeVisible();
  await expect(page.locator(".v-snackbar__wrapper.app-toast")).toHaveCSS(
    "background-color",
    "rgb(53, 53, 66)",
  );
  await expect(content).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(content).toHaveCSS("font-weight", "700");
  await expect(content).toHaveCSS("text-align", "center");
  expect(await content.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Noto Serif JP");
  // 文字が中央に来ている(左右の余白がほぼ同じ)
  const gap = await content.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return Math.abs(text.left - box.left - (box.right - text.right));
  });
  expect(gap).toBeLessThan(2);
  // 明朝体の太字を読み込んで表示している
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('700 16px "Noto Serif JP"', "未実装")))
    .toBe(true);
  await page.screenshot({ path: process.env.TOAST_SHOT ?? "test-results/toast.png" });
});

test("確認ダイアログの本文は Noto Serif JP。明朝体を使わない画面でも、最初のダイアログのときに読み込む", async ({
  page,
}) => {
  await mockApi(page, { loggedIn: true, hymns: makeHymns(1) });
  await page.goto("/mainmenu");
  await page.getByRole("button", { name: "ログアウト", exact: true }).click();

  const text = page.getByRole("alertdialog").locator("#feedback-dialog-text");
  await expect(text).toHaveText("ログアウトしますか。");
  expect(await text.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Noto Serif JP");
  await expect(text).toHaveCSS("font-weight", "400");
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('400 16px "Noto Serif JP"', "ログアウト")))
    .toBe(true);
});
