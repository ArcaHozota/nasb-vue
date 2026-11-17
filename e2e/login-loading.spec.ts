import { expect, test, type Page } from "@playwright/test";
import { mockApi } from "./mock-api";

async function prepareLogin(page: Page) {
  await page.clock.install({ time: new Date("2026-11-18T00:00:00Z") });
  await page.goto("/login");
  await page.evaluate(() => document.fonts.ready);
  await page.clock.pauseAt(new Date("2026-11-18T00:01:00Z"));
  await page.getByLabel("ユーザー名").fill("tester");
  await page.getByLabel("パスワード").fill("secret");
}

const isLoginResponse = (url: string) => new URL(url).pathname === "/api/login";

async function expectMainMenu(page: Page) {
  // 3300msの待機後、描画・遷移に必要な1フレームだけを進める。
  await page.clock.runFor(16);
  await expect.poll(async () => {
    // 追加の待機時間は進めず、通信後の0msタスクだけを処理する。
    await page.clock.runFor(0);
    return new URL(page.url()).pathname;
  }).toBe("/mainmenu");
}

for (const status of [200, 401, 500]) {
  test(`速い${status}応答でも3300msまでは待機し、完了時に結果を表示する`, async ({ page }) => {
    await mockApi(page, { login: { status } });
    await prepareLogin(page);
    const response = page.waitForResponse((res) => isLoginResponse(res.url()));
    const ready = status === 200
      ? page.waitForResponse((res) => new URL(res.url()).pathname === "/api/common/csrf")
      : response;
    await page.getByRole("button", { name: "ログイン", exact: true }).click();
    await response;
    await ready;

    const form = page.getByRole("form", { name: "ログイン", exact: true });
    await expect(form).toHaveAttribute("aria-busy", "true");
    await expect(page.locator("#login-username")).toBeDisabled();
    await expect(page.locator("#login-password")).toBeDisabled();
    await expect(page.locator(".login-card__fields")).toBeHidden();
    await expect(page.getByRole("button", { name: "ログイン中", exact: true })).toBeVisible();
    if (status === 200) {
      const appearance = await page.locator(".login-card").evaluate((card) => ({
        cardOpacity: getComputedStyle(card, "::before").opacity,
        cardBackground: getComputedStyle(card, "::before").backgroundColor,
        cardBlur: getComputedStyle(card, "::before").backdropFilter,
        buttonOpacity: getComputedStyle(card.querySelector("button")!).opacity,
      }));
      // 背景色は不透明にしてから全体を33%にする(実効的な背景色の不透明度も33%)
      expect(appearance).toEqual({
        cardOpacity: "0.33",
        cardBackground: "rgb(15, 23, 42)",
        cardBlur: "none",
        buttonOpacity: "1",
      });
    }

    await page.clock.runFor(3299);
    await expect(page).toHaveURL(/\/login$/);
    await expect(form).toHaveAttribute("aria-busy", "true");
    await expect(page.locator(".login-card__error")).toHaveCount(0);
    await page.clock.runFor(1);

    if (status === 200) {
      await expectMainMenu(page);
    } else {
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.locator(".login-card__error")).toContainText(status === 401
        ? "ユーザー名またはパスワードが正しくありません。"
        : "ログインできませんでした。時間をおいて再度お試しください。");
      await expect(form).toHaveAttribute("aria-busy", "false");
      await expect(page.locator("#login-username")).toBeEnabled();
      await expect(page.locator("#login-username")).toHaveValue("tester");
      await expect(page.locator("#login-password")).toBeEnabled();
      await expect(page.locator("#login-password")).toHaveValue("secret");
      await expect(page.locator(".login-card__fields")).toBeVisible();
      await expect(page.getByRole("button", { name: "ログイン", exact: true })).toBeEnabled();
    }
  });
}

for (const status of [200, 401]) {
  test(`遅い${status}応答は3300msを過ぎても待ち、応答後の追加待機をしない`, async ({ page }) => {
    await mockApi(page, { login: { status } });
    let release = () => {};
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/login", async (route) => {
      await pending;
      await route.fallback();
    });
    await prepareLogin(page);
    try {
      const requested = page.waitForRequest((req) => isLoginResponse(req.url()));
      await page.getByRole("button", { name: "ログイン", exact: true }).click();
      await requested;
      await page.clock.runFor(4000);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("button", { name: "ログイン中", exact: true })).toBeVisible();
      await expect(page.locator("#login-username")).toBeDisabled();
      await expect(page.locator(".login-card__error")).toHaveCount(0);
      release();
      // 応答後は描画用の1フレームだけを許し、追加の3300ms待機がないことを確認する。
      if (status === 200) {
        await expectMainMenu(page);
      } else {
        await expect(page.locator(".login-card__error")).toContainText("ユーザー名またはパスワードが正しくありません。");
        await expect(page.locator("#login-username")).toBeEnabled();
      }
    } finally {
      release();
    }
  });
}
