import { expect, test, type Page } from "@playwright/test";
import { mockApi } from "./mock-api";

async function openPersonal(page: Page) {
  await mockApi(page, { loggedIn: true });
  await page.route("**/api/students/1", (route) => route.fulfill({ json: {
    loginAccount: "original", username: "Original user", password: "********",
    dateOfBirth: "2000-01-01", email: "test@example.com",
  } }));
  await page.route("**/api/students/duplicate-check**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/api/youtube/status", (route) => route.fulfill({ json: { linked: false } }));
  await page.goto("/personal");
  await expect(page.getByLabel("名称", { exact: true })).toHaveValue("Original user");
}

const beforeUnloadIsBlocked = (page: Page) => page.evaluate(() => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
});

test("本人情報の未保存変更は画面移動・再読み込みで確認し、取り消すと編集内容を保持する", async ({ page }) => {
  await openPersonal(page);
  expect(await beforeUnloadIsBlocked(page)).toBe(false);
  await page.getByLabel("名称", { exact: true }).fill("Unsaved user");
  await expect.poll(() => beforeUnloadIsBlocked(page)).toBe(true);
  const menu = page.getByRole("button", { name: "メインメニューへ", exact: true });
  await menu.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("編集中の内容があります");
  await dialog.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/personal$/);
  await expect(page.getByLabel("名称", { exact: true })).toHaveValue("Unsaved user");
  await menu.click();
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page).toHaveURL(/\/mainmenu$/);
});

test("YouTube連携への移動も破棄を確認し、承諾時に二重の離脱確認を出さない", async ({ page }) => {
  await openPersonal(page);
  await page.getByLabel("名称", { exact: true }).fill("Unsaved user");
  const connect = page.getByRole("button", { name: "YouTubeと連携", exact: true });
  await connect.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("編集中の内容があります");
  await dialog.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/personal$/);
  let unexpectedNativeConfirm = false;
  page.on("dialog", async (native) => { unexpectedNativeConfirm = true; await native.dismiss(); });
  await page.route("**/api/youtube/authorize-url", (route) => route.fulfill({ contentType: "text/html", body: "<h1>OAuth test</h1>" }));
  await connect.click();
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page).toHaveURL(/\/api\/youtube\/authorize-url$/);
  expect(unexpectedNativeConfirm).toBe(false);
});

test("更新失敗時は編集を保持し、再試行が成功すると未保存確認なしで戻る", async ({ page }) => {
  await openPersonal(page);
  let updates = 0;
  await page.route("**/api/students/1", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    updates++;
    await route.fulfill({ status: updates === 1 ? 500 : 200, json: updates === 1 ? "保存失敗" : "更新しました" });
  });
  await page.getByLabel("名称", { exact: true }).fill("Saved user");
  await page.getByRole("button", { name: "更新", exact: true }).click();
  await expect(page.getByText("保存失敗", { exact: true })).toBeVisible();
  expect(await beforeUnloadIsBlocked(page)).toBe(true);
  await expect(page.getByLabel("名称", { exact: true })).toHaveValue("Saved user");
  await page.getByRole("button", { name: "更新", exact: true }).click();
  await expect(page).toHaveURL(/\/mainmenu$/);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(updates).toBe(2);
});

test("古いアカウントの重複応答が後から来ても、新しいアカウントで保存できる", async ({ page }) => {
  await openPersonal(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let oldReceived = false;
  await page.route("**/api/students/duplicate-check**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("loginAccount") === "old") {
      oldReceived = true;
      await gate;
      return route.fulfill({ status: 409, body: "" }).catch(() => {});
    }
    return route.fulfill({ status: 200, body: "" });
  });
  let stored: unknown;
  await page.route("**/api/students/1", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    stored = route.request().postDataJSON();
    await route.fulfill({ json: "更新しました" });
  });
  const account = page.getByLabel("アカウント", { exact: true });
  await account.fill("old");
  await page.getByLabel("名称", { exact: true }).click();
  await expect.poll(() => oldReceived).toBe(true);
  await account.fill("new-account");
  await page.getByLabel("名称", { exact: true }).click();
  release();
  await page.getByRole("button", { name: "更新", exact: true }).click();
  await expect(page).toHaveURL(/\/mainmenu$/);
  expect(stored).toMatchObject({ loginAccount: "new-account" });
});

test("画面は項目ごとのカード。YouTube連携は状態のチップと1つのボタンで、解除は確認してから行う", async ({ page }) => {
  await mockApi(page, { loggedIn: true });
  await page.route("**/api/students/1", (route) => route.fulfill({ json: {
    loginAccount: "original", username: "Original user", password: "********",
    dateOfBirth: "2000-01-01", email: "test@example.com",
  } }));
  let linked = true;
  let unlinks = 0;
  await page.route("**/api/youtube/status", (route) => route.fulfill({ json: { linked } }));
  await page.route("**/api/youtube/unlink", (route) => { unlinks++; linked = false; return route.fulfill({ status: 204 }); });
  await page.goto("/personal");
  await expect(page.getByLabel("名称", { exact: true })).toHaveValue("Original user");

  // 「基本情報」「セキュリティ」「YouTube連携」の3枚のカード(Vuetify の v-card)。ラベルは欄の中
  const sections = page.locator(".personal__section");
  await expect(sections).toHaveCount(3);
  await expect(sections.locator(".v-card-title")).toHaveText(["基本情報", "セキュリティ", "YouTube連携"]);
  await expect(page.locator(".personal__section .v-field--variant-outlined")).toHaveCount(5);
  // タイトルは Noto Serif JP の太字。カードの幅は見えている画面の幅の62%(サイドバーを閉じても同じ)
  const title = page.locator(".personal__title");
  await expect(title).toHaveText("ユーザー情報更新");
  expect(await title.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Noto Serif JP");
  await expect(title).toHaveCSS("font-weight", "700");
  const widthRatio = () =>
    page.locator(".personal__card").evaluate((el) => el.getBoundingClientRect().width / window.innerWidth);
  expect(await widthRatio()).toBeCloseTo(0.62, 2);
  await page.getByRole("button", { name: "サイドバーの開閉" }).click();
  await expect.poll(widthRatio).toBeCloseTo(0.62, 2);
  await page.getByRole("button", { name: "サイドバーの開閉" }).click();
  // フッターは「廃棄」が左、「更新」が右
  const footer = page.locator(".personal__footer");
  await expect(footer.getByRole("button")).toHaveText(["廃棄", "更新"]);

  // 連携済み: チップと「連携を解除」だけ(スイッチは無い)
  const youtube = sections.nth(2);
  await expect(youtube).toContainText("連携済み");
  await expect(youtube.locator(".v-switch")).toHaveCount(0);
  if (process.env.PERSONAL_SHOT) await page.screenshot({ path: process.env.PERSONAL_SHOT, fullPage: true });
  await youtube.getByRole("button", { name: "連携を解除" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("YouTube連携を解除しますか。");
  await dialog.getByRole("button", { name: "戻る" }).click();
  expect(unlinks).toBe(0);
  await youtube.getByRole("button", { name: "連携を解除" }).click();
  await dialog.getByRole("button", { name: "OK" }).click();
  await expect(youtube).toContainText("未連携");
  await expect(youtube.getByRole("button", { name: "YouTubeと連携" })).toBeVisible();
  expect(unlinks).toBe(1);
});
