// トースト・確認ダイアログ(FeedbackHost)の文字: Noto Serif JP(トーストは太字 700、ダイアログの本文は semi-bold の 600)。
// 文字の範囲は Fontsource の定義を維持する。どの画面でも出るが、明朝体を使わない画面(ログイン等)の
// 初回CSSを増やさないよう、最初のトースト・ダイアログを出す直前に読み込む。
import "@fontsource/noto-serif-jp/600.css";
import "@fontsource/noto-serif-jp/700.css";
