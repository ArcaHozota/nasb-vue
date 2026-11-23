import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

test.describe("ログイン", () => {
  test("成功するとメインメニューへ移動する", async ({ page }) => {
    await mockApi(page, { login: { status: 200 } });
    await page.goto("/login");

    await page.getByLabel("ユーザー名").fill("tester");
    await page.getByLabel("パスワード").fill("secret");
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(page).toHaveURL(/\/mainmenu$/);
    await expect(
      page.getByRole("heading", { name: "メインメニュー" }),
    ).toBeVisible();
  });

  test("401 のときはパスワード誤りの文言を出す", async ({ page }) => {
    await mockApi(page, { login: { status: 401 } });
    await page.goto("/login");

    await page.getByLabel("ユーザー名").fill("tester");
    await page.getByLabel("パスワード").fill("wrong");
    await page.getByLabel("パスワード").press("Enter");

    await expect(
      page.getByText("ユーザー名またはパスワードが正しくありません。"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("サーバーエラーのときはパスワード誤りと区別して伝える", async ({
    page,
  }) => {
    await mockApi(page, { login: { status: 500 } });
    await page.goto("/login");

    await page.getByLabel("ユーザー名").fill("tester");
    await page.getByLabel("パスワード").fill("secret");
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(
      page.getByText("ログインできませんでした。時間をおいて再度お試しください。"),
    ).toBeVisible();
    await expect(
      page.getByText("ユーザー名またはパスワードが正しくありません。"),
    ).toHaveCount(0);
  });

  test("ユーザー名の欄でも Enter で送信でき、連打しても1回しか送らない", async ({
    page,
  }) => {
    const api = await mockApi(page, { login: { status: 401, delayMs: 500 } });
    await page.goto("/login");

    await page.getByLabel("パスワード").fill("secret");
    const username = page.getByLabel("ユーザー名");
    await username.fill("tester");
    await username.press("Enter");
    // 待機中は入力欄が非表示・無効になる。フォームの連続送信もガードする。
    await page.getByRole("form", { name: "ログイン", exact: true }).evaluate((form) => {
      (form as HTMLFormElement).requestSubmit();
      (form as HTMLFormElement).requestSubmit();
    });

    await expect(
      page.getByText("ユーザー名またはパスワードが正しくありません。"),
    ).toBeVisible();
    expect(
      api.calls.filter((c) => c.method === "POST" && c.path === "/login"),
    ).toHaveLength(1);
  });
});

test("未ログインで管理画面を開くとホームへ戻る", async ({ page }) => {
  await mockApi(page, { loggedIn: false });
  await page.goto("/hymns");
  await expect(page).toHaveURL(/\/home$/);
});

test("入力欄: outlined の欄の中にラベル・アイコンがあり、目のボタンでパスワードを表示・非表示にできる", async ({
  page,
}) => {
  await mockApi(page, {});
  await page.goto("/login");

  const card = page.locator(".login-card");
  const username = page.getByLabel("ユーザー名");
  const password = page.getByLabel("パスワード", { exact: true });
  // ラベルは欄の中(Vuetify の浮くラベル)。欄の外の別のラベルは置かない
  await expect(card.locator(".login-card__input .v-field--variant-outlined")).toHaveCount(2);
  await expect(card.locator(".login-card__input .v-field__prepend-inner .v-icon")).toHaveCount(2);

  await username.fill("tester");
  await password.fill("secret");
  // 欄は Vuetify の暗い背景用の配色(theme="dark")。入力した文字は白系
  await expect(page.locator(".login-card__input.v-theme--dark")).toHaveCount(2);
  await expect(username).toHaveCSS("color", "rgb(255, 255, 255)");

  // 目のボタン: 押すと文字を表示し、もう一度押すと隠す(送信はしない)
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "入力した文字を表示する" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("secret");
  await page.getByRole("button", { name: "入力した文字を隠す" }).click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(page).toHaveURL(/\/login$/);

  await password.focus();
  if (process.env.LOGIN_SHOT) await card.screenshot({ path: process.env.LOGIN_SHOT });
});

test("入力チェック: ユーザー名・パスワードが空なら、それぞれの欄に「入力してください。」を出し、送信しない", async ({
  page,
}) => {
  const api = await mockApi(page, { login: { status: 200 } });
  await page.goto("/login");
  const logins = () => api.calls.filter((c) => c.path === "/login").length;
  const usernameField = page.locator(".login-card__input").nth(0);
  const passwordField = page.locator(".login-card__input").nth(1);

  // 両方とも空
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(usernameField).toContainText("入力してください。");
  await expect(passwordField).toContainText("入力してください。");
  await expect(page).toHaveURL(/\/login$/);
  expect(logins()).toBe(0);

  // ユーザー名だけ入れる -> パスワードの欄だけにエラー
  await page.getByLabel("ユーザー名").fill("tester");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(usernameField).not.toContainText("入力してください。");
  await expect(passwordField).toContainText("入力してください。");
  expect(logins()).toBe(0);

  // 両方入れると送信する
  await page.getByLabel("パスワード", { exact: true }).fill("secret");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/mainmenu$/);
  expect(logins()).toBe(1);
});
