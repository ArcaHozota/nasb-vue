// PC版ホームの一致度(lineNumber)ごとの◆表示。検索していないときは出さない。
// tone は色のクラス名(各コンポーネントの CSS で定義)。
const MATCH: Record<string, { label: string; mark: string; tone: string }> = {
  CADMIUM: { label: "よく一致", mark: "◆◆◆", tone: "tone-cadmium" },
  BURGUNDY: { label: "一致", mark: "◆◆◇", tone: "tone-burgundy" },
  NAPLES: { label: "やや一致", mark: "◆◇◇", tone: "tone-naples" },
};
const RELATED = { label: "関連", mark: "◇◇◇", tone: "tone-related" };

export const matchOf = (line: string) => MATCH[line] ?? RELATED;

/** 目次の番号(全体での通し番号) */
export const hymnNo = (page: number, pageSize: number, i: number) =>
  String((page - 1) * pageSize + i + 1).padStart(2, "0");
