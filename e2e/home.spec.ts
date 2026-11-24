import { expect, test } from "@playwright/test";
import { makeHymns, mockApi } from "./mock-api";

test.use({ viewport: { width: 1440, height: 900 } });

test("PCホーム: 左に一覧(1ページ10曲)、右に選んだ曲の詳細", async ({
  page,
}) => {
  const lines = [
    "CADMIUM",
    "CADMIUM",
    "BURGUNDY",
    "BURGUNDY",
    "NAPLES",
    "NAPLES",
    "SNOWY",
    "SNOWY",
  ];
  const hymns = makeHymns(13).map((h, i) => ({
    ...h,
    lineNumber: lines[i] ?? "SNOWY",
    lyric:
      "주의 크신 은혜를 날마다 노래하네\n어두운 길 걸을 때도 함께 하시네\n\n넘치는 은혜 감사하며 나아가리",
  }));
  await mockApi(page, { hymns });
  await page.goto("/home");

  await expect(page.locator(".desktop-home__bar")).toHaveCSS(
    "background-color",
    "rgb(253, 250, 242)",
  );
  const search = page.getByRole("search").getByLabel("キーワード");
  await search.fill("은혜");
  await search.press("Enter");

  // ヘッダーの「ログイン」は太さ800
  const login = page.getByRole("button", { name: "ログイン", exact: true });
  await expect(login).toHaveCSS("font-weight", "800");
  await expect(login).toHaveCSS("background-color", "rgb(255, 255, 240)");

  const list = page.getByRole("region", { name: "曲の一覧" });
  await expect(list.getByText("13件 ・ 一致度の高い順")).toBeVisible();
  const rows = list.locator("[data-hymn-row]");
  const rings = list.locator(".desktop-home__ring");
  await expect(rows).toHaveCount(10);
  await expect(rings).toHaveCount(10);
  await expect(rows.first()).toContainText("よく一致");
  await expect(rows.nth(2)).toContainText("一致");
  await expect(rows.nth(6)).toContainText("関連");
  await expect(list.getByText("1 / 2")).toBeVisible();

  const expectRingHolesAligned = async () => {
    await expect
      .poll(() =>
        list.evaluate((element) => {
          const rows = element.querySelectorAll("[data-hymn-row]");
          const rings = element.querySelectorAll(".desktop-home__ring");
          const offsets = Array.from(rows).flatMap((row, i) => {
            const bounds = row.getBoundingClientRect();
            const ring = rings[i];
            const ringTop = ring.getBoundingClientRect().top;
            const target = bounds.top + bounds.height * 0.62;
            return ["::before", "::after"].map((pseudoElement) => {
              const hole = getComputedStyle(ring, pseudoElement);
              const translation = new DOMMatrixReadOnly(hole.transform).m42;
              const center =
                ringTop + parseFloat(hole.top) + translation + parseFloat(hole.height) / 2;
              return Math.abs(center - target);
            });
          });
          return Math.max(...offsets);
        }),
      )
      .toBeLessThan(0.5);
  };
  await expectRingHolesAligned();

  const detail = page.getByRole("article", { name: "賛美歌1の詳細" });
  await expect(detail.getByRole("heading", { name: "賛美歌1" })).toBeVisible();
  await expect(detail.getByText("「은혜」に一致: 2箇所")).toBeVisible();
  await expect(detail.locator("mark")).toHaveCount(2);
  await expect(detail.getByText("G＊")).toBeVisible();
  // 最初はオリジナルキー(G)の五線譜。調のチップを選ぶと五線譜の調が変わる(押すとその調をダウンロード)
  await expect(
    detail.getByRole("button", { name: "ト長調の楽譜をダウンロード" }),
  ).toBeVisible();
  await detail.getByText("F", { exact: true }).click();
  await expect(
    detail.getByRole("button", { name: "ヘ長調の楽譜をダウンロード" }),
  ).toBeVisible();
  await detail.getByText("G＊").click();
  // ブックは幅 1190px・高さ 740px、行は 64px で10行がスクロールなしで収まる
  const size = await page.evaluate(() => {
    const main = document
      .querySelector(".desktop-home__main")!
      .getBoundingClientRect();
    const row = document
      .querySelector("[data-hymn-row]")!
      .getBoundingClientRect();
    const scroll = document.querySelector(".desktop-home__scroll")!;
    return {
      w: main.width,
      h: main.height - 32,
      row: row.height,
      overflow: scroll.scrollHeight - scroll.clientHeight,
    };
  });
  console.log(JSON.stringify(size));
  expect(size).toMatchObject({ w: 1190, h: 740, row: 64 });
  expect(size.overflow).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: process.env.HOME_SHOT ?? "test-results/home-pc.png",
  });

  // 行を押すと右の詳細が替わる
  await rows.nth(2).click();
  await expect(
    page.getByRole("article", { name: "賛美歌3の詳細" }),
  ).toBeVisible();

  // 一覧をスクロールしても対応する行からリングがずれない
  const book = page.locator(".desktop-home__main");
  await book.evaluate((element) => {
    element.style.height = "560px";
  });
  const scroll = list.locator(".desktop-home__scroll");
  await scroll.evaluate((element) => {
    element.scrollTop = 96;
  });
  await expect
    .poll(() => scroll.evaluate((element) => element.scrollTop))
    .toBe(96);
  await expectRingHolesAligned();
  await book.evaluate((element) => {
    element.style.removeProperty("height");
  });

  await list.getByRole("button", { name: "次", exact: true }).click();
  await expect(rows.first()).toContainText("賛美歌11");
  await expect(rows).toHaveCount(3);
  await expect(rings).toHaveCount(3);
  await expectRingHolesAligned();
});
