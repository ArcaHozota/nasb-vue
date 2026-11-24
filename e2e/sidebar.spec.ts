import { expect, test } from "@playwright/test";
import { makeHymns, mockApi } from "./mock-api";

test.use({ viewport: { width: 1440, height: 900 } });

test("管理画面のロゴ・ナビゲーション・カードの見出しは #fffff0 で表示する", async ({ page }) => {
  await mockApi(page, { loggedIn: true, hymns: makeHymns(3) });
  await page.goto("/hymns");

  const nav = page.getByRole("navigation").getByLabel("メニュー");
  const foreground = "rgb(255, 255, 240)";
  for (const t of ["聖書章節選択", "聖書章節入力", "賛美歌一覧", "ランダム検索", "レシート明細入力"]) {
    const label = nav.getByText(t, { exact: true });
    await expect(label).toBeVisible();
    await expect(label).toHaveCSS("color", foreground);
  }
  // 見出し・区切り線は置かない
  await expect(nav.locator(".v-list-subheader, .v-divider")).toHaveCount(0);
  const current = nav.locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toContainText("賛美歌一覧");
  await expect(page.locator(".admin-sidebar")).toHaveCSS("background-color", "rgb(37, 37, 48)");
  const bar = page.locator(".admin-bar");
  await expect(bar).toHaveCSS("background-color", "rgb(37, 37, 48)");
  await expect(bar.getByRole("button", { name: "サイドバーの開閉" })).toHaveCSS("color", foreground);
  await expect(bar.getByRole("button", { name: "ログアウト", exact: true })).toHaveCSS("color", foreground);
  await expect(current).toHaveCSS("background-color", "rgb(53, 53, 66)");
  const title = page.getByRole("heading", { name: "賛美歌情報メンテナンス" });
  await expect(title.locator("..")).toHaveCSS("background-color", "rgb(53, 53, 66)");
  await expect(title).toHaveCSS("color", foreground);
  await expect(title).toHaveCSS("font-weight", "700");
  // 選択中は左端に白い線(3px)
  await expect(current).toHaveCSS("border-left-color", "rgb(255, 255, 255)");
  await expect(current).toHaveCSS("border-left-width", "3px");
  // ロゴのエルサレム十字と文字もナビゲーションと同じ色。
  await expect(page.locator(".admin-brand .jerusalem-cross")).toBeVisible();
  await expect(page.locator(".admin-brand .jerusalem-cross")).toHaveCSS("color", foreground);
  await expect(page.locator(".admin-brand__title")).toHaveCSS("color", foreground);
  const username = page.locator(".admin-user__name");
  await expect(username).toHaveCSS("color", foreground);
  await expect(page.locator(".admin-user__avatar")).toHaveCSS("color", foreground);
  await username.click();
  const personal = page.getByText("個人スペース", { exact: true });
  await expect(personal).toHaveCSS("color", foreground);
  // 開くアニメーションが終わってから Esc を押す(途中で押すと、Vuetify のメニューがまだ Esc を受け付けないことがある)
  const menuContent = page.locator(".v-menu .v-overlay__content");
  await expect(menuContent).toBeVisible();
  await expect(menuContent).not.toHaveClass(/-enter-/);
  await page.keyboard.press("Escape");
  await expect(personal).toBeHidden();
  await page.screenshot({ path: process.env.SIDEBAR_SHOT ?? "test-results/sidebar.png" });

  // 押すとその画面へ移り、選択中も移る
  await nav.getByText("ランダム検索").click();
  await expect(page).toHaveURL(/\/hymns\/random-five/);
  await expect(nav.locator('[aria-current="page"]')).toContainText("ランダム検索");
  await expect(page.getByRole("heading", { name: "賛美歌ランダム選択" })).toHaveCSS("color", foreground);

  await page.goto("/books/add");
  await expect(page.getByRole("heading", { name: "聖書章節入力" })).toHaveCSS("color", foreground);

  await page.goto("/personal");
  await expect(page.getByRole("heading", { name: "ユーザー情報更新" })).toHaveCSS("color", foreground);

  await page.goto("/mainmenu");
  for (const name of ["聖書奉読", "賛美歌集め", "ランダム選択"]) {
    await expect(page.getByRole("heading", { name })).toHaveCSS("color", foreground);
  }
});
