import { expect, test, type Page } from "@playwright/test";
import { makeHymns, mockApi } from "./mock-api";

const fontWeights = (page: Page) =>
  page.evaluate(() =>
    [
      ...new Set(
        [...document.fonts].map(
          (font) => `${font.family.replace(/^['"]|['"]$/g, "")}:${font.weight}`,
        ),
      ),
    ].sort(),
  );

async function expectWoff2Sources(page: Page) {
  const sources = await page.evaluate(() =>
    [...document.styleSheets].flatMap((sheet) =>
      [...sheet.cssRules]
        .filter(
          (rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule,
        )
        .map((rule) => rule.style.getPropertyValue("src")),
    ),
  );
  expect(sources.length).toBeGreaterThan(0);
  for (const src of sources) {
    expect(src).toContain("woff2");
    expect(src).not.toMatch(/format\(['"]woff['"]\)/);
  }
}

test("ログイン画面ではゴシック体の追加ウェイトもWOFF2で読み込む", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "ログイン", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await fontWeights(page)).toEqual([
    "Noto Sans JP:400",
    "Noto Sans JP:500",
    "Noto Sans JP:700",
    "Noto Sans JP:800",
    "Noto Sans JP:900",
  ]);
  const loaded = await page.evaluate(async () => {
    const faces = await Promise.all([
      document.fonts.load('900 26px "Noto Sans JP"', "NASB1995"),
      document.fonts.load('800 14px "Noto Sans JP"', "ログイン"),
    ]);
    return faces.map((list) =>
      list.length > 0 && list.every((face) => face.status === "loaded"),
    );
  });
  expect(loaded).toEqual([true, true]);
  await expectWoff2Sources(page);
});

test("ホームと管理画面で必要な明朝体の太さを読み込み、日本語・韓国語を自前フォントで表示できる", async ({
  page,
}) => {
  await mockApi(page, { loggedIn: true, hymns: makeHymns(2) });
  await page.goto("/home");
  await expect(page.locator("[data-hymn-row]")).toHaveCount(2);
  await page.evaluate(() => document.fonts.ready);
  const home = await fontWeights(page);
  expect(home).toContain("Noto Serif JP:400");
  expect(home).toContain("Noto Serif JP:700");
  expect(home).toContain("Noto Serif KR:400");
  expect(home).toContain("Niconne:400");
  expect(home).not.toContain("Noto Serif JP:600");
  expect(home).not.toContain("Noto Serif KR:600");
  expect(home).not.toContain("Noto Serif KR:700");
  // PC ホームの「ログイン」ボタンは太さ800(見出し用の900は読み込まない)
  expect(home).toContain("Noto Sans JP:800");
  expect(home).not.toContain("Noto Sans JP:900");

  await page.goto("/hymns");
  await expect(
    page.getByRole("heading", { name: "賛美歌情報メンテナンス" }),
  ).toBeVisible();
  expect(await fontWeights(page)).toEqual(
    expect.arrayContaining([
      "Noto Serif JP:400",
      "Noto Serif JP:600",
      "Noto Serif JP:700",
      "Noto Serif KR:400",
      "Noto Serif KR:600",
      "Noto Serif KR:700",
    ]),
  );
  const loaded = await page.evaluate(async () => {
    const faces = await Promise.all([
      document.fonts.load('600 16px "Noto Serif JP"', "祈り"),
      document.fonts.load('700 16px "Noto Serif KR"', "기도"),
    ]);
    return faces.map(
      (list) =>
        list.length > 0 && list.every((face) => face.status === "loaded"),
    );
  });
  expect(loaded).toEqual([true, true]);
  await expectWoff2Sources(page);
});
