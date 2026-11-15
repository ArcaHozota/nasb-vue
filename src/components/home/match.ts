// PC版ホームの一致度(lineNumber)ごとの表示。検索していないときは出さない。
//   label: 一致度の文言(一覧の右端・詳細のチップ)
//   tone : 文字色のクラス名(各コンポーネントの CSS で定義)
//   dot  : 一覧の左端の丸の色
//   chip : 詳細の一致度チップの色(v-chip の color)
type Match = { label: string; tone: string; dot: string; chip: string };

const MATCH: Record<string, Match> = {
  CADMIUM: {
    label: "よく一致",
    tone: "tone-cadmium",
    dot: "#14653a",
    chip: "#14653a",
  },
  BURGUNDY: {
    label: "一致",
    tone: "tone-burgundy",
    dot: "#800020",
    chip: "#800020",
  },
  NAPLES: {
    label: "やや一致",
    tone: "tone-naples",
    dot: "#d4a72c",
    chip: "#8a6400",
  },
};
const RELATED: Match = {
  label: "関連",
  tone: "tone-related",
  dot: "#c9c9cf",
  chip: "#6b6b73",
};

export const matchOf = (line: string): Match => MATCH[line] ?? RELATED;

/** 一覧の番号(全体での通し番号) */
export const hymnNo = (page: number, pageSize: number, i: number) =>
  String((page - 1) * pageSize + i + 1).padStart(2, "0");
