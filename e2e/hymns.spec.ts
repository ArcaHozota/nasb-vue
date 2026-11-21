import { expect, test } from "@playwright/test";
import { makeHymns, mockApi } from "./mock-api";

test.describe("賛美歌一覧", () => {
  test("件数とページ数を表示する", async ({ page }) => {
    await mockApi(page, { loggedIn: true, hymns: makeHymns(11) });
    await page.goto("/hymns");

    await expect(page.getByText("全11件 / 1 / 2ページ")).toBeVisible();
    await expect(page.getByRole("button", { name: "削除" })).toHaveCount(10);
  });

  test("最後のページの最後の1件を削除すると、前のページへ戻る", async ({
    page,
  }) => {
    const api = await mockApi(page, { loggedIn: true, hymns: makeHymns(11) });
    await page.goto("/hymns");

    await page.getByRole("button", { name: "2ページ目" }).click();
    await expect(page.getByText("全11件 / 2 / 2ページ")).toBeVisible();
    await expect(page.getByText("賛美歌11", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "削除" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("賛美歌11");
    // 警告は「!」のアイコン(タイトルと同じ臙脂)。アイコンと本文の欄はダイアログの幅の62%
    const body = dialog.locator(".feedback-dialog-body");
    const icon = body.locator(".v-icon");
    await expect(icon).toHaveAttribute("data-icon", "mdi-alert-circle-outline");
    await expect(icon).toHaveCSS("color", "rgb(128, 0, 32)");
    const ratio = await body.evaluate(
      (el) => el.getBoundingClientRect().width / el.closest(".v-card")!.getBoundingClientRect().width,
    );
    expect(ratio).toBeCloseTo(0.62, 2);
    await expect(dialog.locator("#feedback-dialog-text")).toHaveText(/よろしいですか。$/);
    // 本文は Noto Serif JP
    expect(
      await dialog.locator("#feedback-dialog-text").evaluate((el) => getComputedStyle(el).fontFamily),
    ).toContain("Noto Serif JP");
    // 21〜40文字の本文は 1.0625rem
    await expect(dialog.locator("#feedback-dialog-text")).toHaveCSS("font-size", "17px");
    // 「戻る」「OK」は区切り線の下のフッターにある
    const footer = dialog.locator(".v-divider + .v-card-actions");
    await expect(footer.getByRole("button", { name: "戻る" })).toBeVisible();
    await expect(footer.getByRole("button", { name: "OK" })).toBeVisible();
    if (process.env.DIALOG_SHOT) {
      await page.waitForTimeout(500); // 開くアニメーションが終わってから撮る
      await page.screenshot({ path: process.env.DIALOG_SHOT });
    }
    await dialog.getByRole("button", { name: "OK" }).click();
    // 削除の通知は固定の文言(削除の応答に X-Page-Num は付かない)
    await expect(page.locator(".app-toast")).toHaveText("削除しました");

    // 空の2ページ目に取り残されず、1ページ目(残り10件)を表示する
    await expect(page.getByText("全10件 / 1 / 1ページ")).toBeVisible();
    await expect(page.getByText("データがありません")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "削除" })).toHaveCount(10);
    expect(api.hymns).toHaveLength(10);
  });

  test("削除の確認で「戻る」を押すと削除しない", async ({ page }) => {
    const api = await mockApi(page, { loggedIn: true, hymns: makeHymns(3) });
    await page.goto("/hymns");

    await page.getByRole("button", { name: "削除" }).first().click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "戻る" })
      .click();

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(api.calls.some((c) => c.method === "DELETE")).toBe(false);
    await expect(page.getByText("全3件 / 1 / 1ページ")).toBeVisible();
  });
});
