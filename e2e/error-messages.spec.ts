import { expect, test } from "@playwright/test";
import { makeHymns, mockApi } from "./mock-api";

for (const scenario of [
  { name: "本文なしの404", status: 404, message: undefined },
  { name: "空白の失敗理由", status: 200, message: " \t\n　" },
  { name: "nullの失敗理由", status: 200, message: null },
]) {
  test(`プレイリストの${scenario.name}にも既定のエラー通知を表示する`, async ({ page }) => {
    await mockApi(page, { loggedIn: true, hymns: makeHymns(1), playlistRunning: true });
    await page.route("**/api/youtube/playlist-status**", (route) => route.fulfill({
      status: scenario.status,
      contentType: "application/json",
      body: scenario.status === 404 ? "" : JSON.stringify({
        playlistId: "PL1", playlistUrl: "", state: "failed",
        total: 1, added: 0, message: scenario.message,
      }),
    }));
    await page.goto("/hymns");
    await expect(page.getByText("賛美歌1", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "プレイリスト作成", exact: true }).click();
    await expect(page.getByText("プレイリスト作成に失敗しました", { exact: true })).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "プレイリスト作成", exact: true })).toBeEnabled();
  });
}

test("ホームの一覧取得エラーが空白のmessageでも既定の通知を表示する", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/hymns?**", (route) => route.fulfill({ status: 500, json: { message: " \t\n　" } }));
  await page.goto("/home");
  await expect(page.getByText("データの取得に失敗しました", { exact: true })).toBeVisible();
});

test("保存エラーのmessageがnullでも既定の通知を表示し、本文を保持する", async ({ page }) => {
  await mockApi(page, { loggedIn: true });
  await page.route("**/api/books**", (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({ status: 500, json: { message: null } });
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith("/chapters")
      ? [{ id: "101", name: "第1章" }]
      : path.endsWith("/verse") ? [] : [{ id: "1", name: "Genesis" }],
    });
  });
  await page.goto("/books/add");
  await expect(page.locator("#chapter-select")).toHaveValue("第1章");
  const english = page.getByRole("textbox", { name: "英語", exact: true });
  await english.fill("Unsaved English text");
  await page.getByRole("textbox", { name: "日本語", exact: true }).fill("未保存の本文");
  await page.getByLabel("節", { exact: true }).fill("1");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await expect(page.getByText("保存に失敗しました", { exact: true })).toBeVisible();
  await expect(english).toHaveJSProperty("textContent", "Unsaved English text");
  await expect(english).toHaveAttribute("contenteditable", "true");
});
