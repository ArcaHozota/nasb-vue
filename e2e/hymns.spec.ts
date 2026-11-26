import { expect, test } from "@playwright/test";
import { makeHymns, mockApi } from "./mock-api";

test.describe("賛美歌一覧", () => {
  test("件数とページ数を表示する", async ({ page }) => {
    await mockApi(page, { loggedIn: true, hymns: makeHymns(11) });
    await page.goto("/hymns");

    for (const name of ["番号", "曲名", "韓国語名", "操作"]) {
      const header = page.getByRole("columnheader", { name, exact: true });
      await expect(header).toHaveCSS("background-color", "rgb(249, 250, 251)");
      await expect(header).toHaveCSS("text-align", "center");
    }
    await expect(page.getByText("1-10 件目 / 11件")).toBeVisible();
    // ページ送り: 「10件/ページ ▾」のメニューボタン・範囲・最初/前/次/最後
    // 表の背景は透明(行からガラスのカードの背景が透ける)。見出しだけ surface の色
    await expect(page.locator(".hymn-list__table")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    const footer = page.locator(".hymn-list__footer");
    // フッターは surface の背景、文字は濃い灰色(#4b5563)の semi-bold
    await expect(footer).toHaveCSS("background-color", "rgb(249, 250, 251)");
    const range = footer.getByText("1-10 件目 / 11件");
    await expect(range).toHaveCSS("color", "rgb(75, 85, 99)");
    await expect(range).toHaveCSS("font-weight", "600");
    // 件数はメニューボタン(下線・枠なし)。ボタンと範囲の文字は同じ高さにそろう
    const sizeButton = footer.getByRole("button", { name: "1ページの件数: 10件" });
    await expect(sizeButton).toHaveText("10件/ページ");
    await expect(footer.locator(".v-select, .v-field")).toHaveCount(0);
    const center = async (l: typeof range) => {
      const b = (await l.boundingBox())!;
      return b.y + b.height / 2;
    };
    expect(Math.abs((await center(sizeButton)) - (await center(range)))).toBeLessThan(2);
    for (const name of ["最初のページ", "前のページ", "次のページ", "最後のページ"]) {
      await expect(footer.getByRole("button", { name })).toBeVisible();
    }
    if (process.env.LIST_SHOT) await page.screenshot({ path: process.env.LIST_SHOT });
    const deleteButtons = page.getByRole("button", { name: "削除" });
    await expect(deleteButtons).toHaveCount(10);
    await expect(deleteButtons.first()).toHaveCSS("color", "rgb(128, 0, 32)");

    const cells = page.locator(".hymn-list__row").first().getByRole("cell");
    // データ行も全列を中央揃え(番号・曲名・韓国語名・操作)
    for (const index of [0, 1, 2, 3]) {
      await expect(cells.nth(index)).toHaveCSS("text-align", "center");
    }

    const table = page.locator(".hymn-list__table-wrap");
    const search = page.locator(".hymn-list__toolbar .v-field");
    const playlist = page.getByRole("button", { name: "プレイリスト作成", exact: true });
    for (const width of [900, 1600]) {
      await page.setViewportSize({ width, height: 900 });
      const tableBox = (await table.boundingBox())!;
      const searchBox = (await search.boundingBox())!;
      const playlistBox = (await playlist.boundingBox())!;
      expect(searchBox.x).toBeCloseTo(tableBox.x, 0);
      expect(searchBox.width).toBeCloseTo(tableBox.width * 0.38, 1);
      expect(playlistBox.x + playlistBox.width).toBeCloseTo(tableBox.x + tableBox.width, 0);
    }

    await page.getByRole("button", { name: "楽譜アップロード", exact: true }).first().click();
    const score = page.getByRole("dialog", { name: /^楽譜-/ });
    await expect(score.locator(".v-card")).toHaveCSS("background-color", "rgb(249, 250, 251)");
  });

  test("最後のページの最後の1件を削除すると、前のページへ戻る", async ({
    page,
  }) => {
    const api = await mockApi(page, { loggedIn: true, hymns: makeHymns(11) });
    await page.goto("/hymns");

    await page.getByRole("button", { name: "次のページ" }).click();
    await expect(page.getByText("11-11 件目 / 11件")).toBeVisible();
    await expect(page.getByText("賛美歌11", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "削除" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("賛美歌11");
    await expect(dialog.locator(".v-card")).toHaveCSS("background-color", "rgb(249, 250, 251)");
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
    await expect(page.getByText("1-10 件目 / 10件")).toBeVisible();
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
    await expect(page.getByText("1-3 件目 / 3件")).toBeVisible();
  });

  test("1ページあたりの件数を変えると、1ページ目から表示し直す", async ({ page }) => {
    await mockApi(page, { loggedIn: true, hymns: makeHymns(11) });
    await page.goto("/hymns");
    await page.getByRole("button", { name: "次のページ" }).click();
    await expect(page.getByText("11-11 件目 / 11件")).toBeVisible();
    const chevron = page.locator(".hymn-list__size-chevron");
    await expect(chevron).not.toHaveClass(/--open/);
    await page.getByRole("button", { name: "1ページの件数: 10件" }).click();
    // 開くと矢印が上向きに回る
    await expect(chevron).toHaveClass(/hymn-list__size-chevron--open/);
    await page.locator(".v-menu .v-list").getByText("5件", { exact: true }).click();
    await expect(page.getByRole("button", { name: "1ページの件数: 5件" })).toBeVisible();
    // 閉じると下向きに戻る
    await expect(chevron).not.toHaveClass(/--open/);
    await expect(page.getByText("1-5 件目 / 11件")).toBeVisible();
    await expect(page.getByRole("button", { name: "削除" })).toHaveCount(5);
  });

  test("ページを送っている間もフッターを出したままにし、表の高さを変えない", async ({ page }) => {
    await mockApi(page, { loggedIn: true, hymns: makeHymns(25) });
    await page.goto("/hymns");
    await expect(page.getByText("1-10 件目 / 25件")).toBeVisible();
    const wrap = page.locator(".hymn-list__table-wrap");
    const before = (await wrap.boundingBox())!.height;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route("**/api/hymns?**", async (route) => {
      await gate;
      await route.fallback();
    });
    await page.getByRole("button", { name: "次のページ" }).click();
    // 読み込み中: フッターは消えず、行は少し薄くなるだけ。高さも変わらない
    await expect(page.locator(".hymn-list__row.is-stale").first()).toBeVisible();
    await expect(page.locator(".hymn-list__footer")).toBeVisible();
    expect((await wrap.boundingBox())!.height).toBe(before);
    release();
    await expect(page.getByText("11-20 件目 / 25件")).toBeVisible();
    expect((await wrap.boundingBox())!.height).toBe(before);
  });
});
