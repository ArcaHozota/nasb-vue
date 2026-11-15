import { expect, test } from "@playwright/test";
import { makeHymns, mockApi } from "./mock-api";

test.use({ viewport: { width: 1440, height: 900 } });

test("PCホーム: 左に一覧(1ページ8曲)、右に選んだ曲の詳細", async ({ page }) => {
  const lines = ["CADMIUM", "CADMIUM", "BURGUNDY", "BURGUNDY", "NAPLES", "NAPLES", "SNOWY", "SNOWY"];
  const hymns = makeHymns(20).map((h, i) => ({
    ...h,
    lineNumber: lines[i] ?? "SNOWY",
    lyric: "주의 크신 은혜를 날마다 노래하네\n어두운 길 걸을 때도 함께 하시네\n\n넘치는 은혜 감사하며 나아가리",
  }));
  await mockApi(page, { hymns });
  await page.goto("/home");

  const search = page.getByRole("search").getByLabel("キーワード");
  await search.fill("은혜");
  await search.press("Enter");

  const list = page.getByRole("region", { name: "曲の一覧" });
  await expect(list.getByText("20件 ・ 一致度の高い順")).toBeVisible();
  const rows = list.locator("[data-hymn-row]");
  await expect(rows).toHaveCount(8);
  await expect(rows.first()).toContainText("よく一致");
  await expect(rows.nth(2)).toContainText("一致");
  await expect(rows.nth(6)).toContainText("関連");
  await expect(list.getByText("1 / 3")).toBeVisible();

  const detail = page.getByRole("article", { name: "賛美歌1の詳細" });
  await expect(detail.getByRole("heading", { name: "賛美歌1" })).toBeVisible();
  await expect(detail.getByText("「은혜」に一致: 2箇所")).toBeVisible();
  await expect(detail.locator("mark")).toHaveCount(2);
  await expect(detail.getByText("G＊")).toBeVisible();
  await page.screenshot({ path: process.env.HOME_SHOT ?? "test-results/home-pc.png" });

  // 行を押すと右の詳細が替わる
  await rows.nth(2).click();
  await expect(page.getByRole("article", { name: "賛美歌3の詳細" })).toBeVisible();
});
