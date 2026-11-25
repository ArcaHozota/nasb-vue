import { expect, test } from "@playwright/test";
import { makeHymns, mockApi } from "./mock-api";

test("初回の読み込み・取得失敗・再試行成功を0件と区別する", async ({ page }) => {
  await mockApi(page, { loggedIn: true, hymns: makeHymns(2) });
  let failing = true;
  let release = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/hymns?**", async (route) => {
    if (!failing) return route.fallback();
    await pending;
    return route.fulfill({ status: 500, json: { message: " \t\n　" } });
  });
  await page.goto("/hymns");

  try {
    await expect(page.getByText("賛美歌一覧を読み込み中です")).toBeAttached();
    await expect(page.getByText("データがありません", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/件目 \/ 0件/)).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: "再試行" })).toHaveCount(0);
  } finally {
    release();
  }

  const alert = page.getByRole("alert").filter({ hasText: "再試行" });
  await expect(alert).toContainText("賛美歌一覧の取得に失敗しました");
  await expect(page.getByText("データがありません", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/件目 \/ 0件/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "プレイリスト作成", exact: true })).toBeDisabled();

  failing = false;
  await alert.getByRole("button", { name: "再試行", exact: true }).click();
  await expect(page.getByText("1-2 件目 / 2件")).toBeVisible();
  await expect(page.getByText("賛美歌1", { exact: true })).toBeVisible();
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole("button", { name: "プレイリスト作成", exact: true })).toBeEnabled();
});

test("ページ移動の取得失敗でも0件にせず、同じページを再試行する", async ({ page }) => {
  await mockApi(page, { loggedIn: true, hymns: makeHymns(11) });
  let failing = true;
  await page.route("**/api/hymns?**", (route) => {
    const url = new URL(route.request().url());
    if (failing && url.searchParams.get("pageNum") === "2") {
      return route.fulfill({ status: 500, json: { message: "一覧の取得を中断しました" } });
    }
    return route.fallback();
  });
  await page.goto("/hymns");
  await expect(page.getByText("1-10 件目 / 11件")).toBeVisible();
  await page.getByRole("button", { name: "次のページ" }).click();

  const alert = page.getByRole("alert").filter({ hasText: "再試行" });
  await expect(alert).toContainText("一覧の取得を中断しました");
  await expect(page.getByText("データがありません", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/件目 \/ 0件/)).toHaveCount(0);

  failing = false;
  await alert.getByRole("button", { name: "再試行", exact: true }).click();
  await expect(page.getByText("11-11 件目 / 11件")).toBeVisible();
  await expect(page.getByText("賛美歌11", { exact: true })).toBeVisible();
  await expect(page.getByText("賛美歌1", { exact: true })).toHaveCount(0);
  await expect(alert).toHaveCount(0);
});

test("正常に取得した0件には空の一覧を表示し、再試行を出さない", async ({ page }) => {
  await mockApi(page, { loggedIn: true, hymns: [] });
  await page.goto("/hymns");

  await expect(page.getByText("データがありません", { exact: true })).toBeVisible();
  await expect(page.getByText("0-0 件目 / 0件")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "再試行" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "再試行", exact: true })).toHaveCount(0);
});

test("検索結果が0件なら前の一覧を消して空の一覧を表示する", async ({ page }) => {
  await mockApi(page, { loggedIn: true, hymns: makeHymns(11) });
  await page.route("**/api/hymns?**", (route) => {
    const url = new URL(route.request().url());
    return url.searchParams.get("keyword") === "該当なし"
      ? route.fulfill({ json: { records: [], totalRecords: 0 } })
      : route.fallback();
  });
  await page.goto("/hymns");
  await expect(page.getByText("1-10 件目 / 11件")).toBeVisible();
  const search = page.getByRole("search").getByLabel("キーワード");
  await search.fill("該当なし");
  await search.press("Enter");

  await expect(page.getByText("データがありません", { exact: true })).toBeVisible();
  await expect(page.getByText("0-0 件目 / 0件")).toBeVisible();
  await expect(page.getByRole("button", { name: "編集", exact: true })).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: "再試行" })).toHaveCount(0);
});

test("検索の取得失敗では確定済みの検索条件を維持して再試行する", async ({ page }) => {
  await mockApi(page, { loggedIn: true, hymns: makeHymns(2) });
  let failing = true;
  const searches: Record<string, string>[] = [];
  await page.route("**/api/hymns?**", (route) => {
    const url = new URL(route.request().url());
    if (!url.searchParams.get("keyword")) return route.fallback();
    searches.push(Object.fromEntries(url.searchParams));
    return failing
      ? route.fulfill({ status: 500, body: "" })
      : route.fulfill({ json: { records: makeHymns(1), totalRecords: 1 } });
  });
  await page.goto("/hymns");
  await expect(page.getByText("1-2 件目 / 2件")).toBeVisible();
  const search = page.getByRole("search").getByLabel("キーワード");
  await search.fill("恵み");
  await search.press("Enter");
  const alert = page.getByRole("alert").filter({ hasText: "再試行" });
  await expect(alert).toContainText("賛美歌一覧の取得に失敗しました");
  await expect(page.getByText("データがありません", { exact: true })).toHaveCount(0);

  // 入力中のキーワードは再試行の対象にせず、失敗した検索をやり直す。
  await search.fill("まだ検索していない語句");
  failing = false;
  await alert.getByRole("button", { name: "再試行", exact: true }).click();
  await expect(page.getByText("1-1 件目 / 1件")).toBeVisible();
  await expect(alert).toHaveCount(0);
  expect(searches.at(-1)).toEqual({ pageNum: "1", pageSize: "10", keyword: "恵み" });
});

test("取得済み一覧の更新失敗は前回の内容であることを示し、再試行で更新する", async ({ page }) => {
  await mockApi(page, { loggedIn: true, hymns: makeHymns(2) });
  let failing = false;
  await page.route("**/api/hymns?**", (route) => failing
    ? route.fulfill({ status: 500, json: { message: null } })
    : route.fallback());
  await page.goto("/hymns");
  await expect(page.getByText("1-2 件目 / 2件")).toBeVisible();

  failing = true;
  await page.getByRole("button", { name: "削除", exact: true }).first().click();
  await page.getByRole("alertdialog").getByRole("button", { name: "OK", exact: true }).click();
  const alert = page.getByRole("alert").filter({ hasText: "再試行" });
  await expect(alert).toContainText("表示中の一覧は前回取得した内容です");
  await expect(page.getByText("賛美歌1", { exact: true })).toBeVisible();
  await expect(page.getByText("賛美歌2", { exact: true })).toBeVisible();
  await expect(page.getByText("（前回取得時）", { exact: true })).toBeVisible();
  await expect(page.getByText("データがありません", { exact: true })).toHaveCount(0);

  failing = false;
  await alert.getByRole("button", { name: "再試行", exact: true }).click();
  await expect(page.getByText("1-1 件目 / 1件")).toBeVisible();
  await expect(page.getByText("賛美歌1", { exact: true })).toHaveCount(0);
  await expect(page.getByText("賛美歌2", { exact: true })).toBeVisible();
  await expect(alert).toHaveCount(0);
  await expect(page.getByText("（前回取得時）", { exact: true })).toHaveCount(0);
});
