import { expect, test } from "@playwright/test";
import { mockApi, makeHymns } from "./mock-api";

test("ログアウト成功後にCSRF取得が失敗してもホームへ戻り、以前のキャッシュを破棄する", async ({ page }) => {
  const api = await mockApi(page, { loggedIn: true, hymns: makeHymns(1) });
  let loggedOut = false;
  await page.route("**/api/logout", async (route) => { loggedOut = true; await route.fulfill({ status: 204 }); });
  await page.route("**/api/common/csrf", (route) => loggedOut
    ? route.fulfill({ status: 500, body: "" }) : route.fallback());
  await page.route("**/api/common/me", (route) => loggedOut
    ? route.fulfill({ status: 401, json: {} }) : route.fallback());
  await page.goto("/hymns");
  await expect(page.getByText("賛美歌1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ログアウト", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "OK", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator("[data-hymn-row]")).toHaveCount(1);
  expect(api.calls.filter((call) => call.path === "/hymns" && call.method === "GET").length).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("heading", { name: "エラーが発生しました" })).toHaveCount(0);
  await page.goto("/hymns");
  await expect(page).toHaveURL(/\/home$/);
});

test("ログアウト要求の失敗は画面内に通知し、もう一度ログアウトできる", async ({ page }) => {
  await mockApi(page, { loggedIn: true, hymns: makeHymns(1) });
  let attempts = 0;
  await page.route("**/api/logout", async (route) => {
    attempts++;
    await route.fulfill({ status: attempts === 1 ? 500 : 204, body: "" });
  });
  await page.goto("/hymns");
  const logout = page.getByRole("button", { name: "ログアウト", exact: true });
  await logout.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByText("ログアウトに失敗しました。もう一度お試しください。", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/hymns$/);
  await expect(page.getByText("賛美歌1", { exact: true })).toBeVisible();
  await logout.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "OK", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  expect(attempts).toBe(2);
});
