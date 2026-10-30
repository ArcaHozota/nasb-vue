# NASB1995 フロントエンド (Vite + Vue 3 + TypeScript + Vuetify 4)

Next.js + shadcn/ui 版からの移行先。UIは Vuetify に統一(Tailwind は使わない)。

- `npm install`
- `npm run dev` : 開発サーバー(`/api` は `http://localhost:8277` へプロキシ)
- `npm run build` : `vue-tsc` で型チェック後、`dist/` に静的ファイルを生成
- `docker build .` : nginx で静的配信(ポート3000、SPAフォールバック付き)

## 構成
- `src/plugins/vuetify.ts` : テーマ(primary #800020 / secondary #003399 / success #355e3b / warning #f6c91c / info #353542 / error #d32f2f、ライト固定)
- `src/plugins/fonts.ts` : Fontsource で Noto Sans JP / Noto Serif JP / Noto Serif KR / Niconne を自前配信
- `src/styles/settings.scss` : Vuetify の Sass 変数(本文フォント)
- `src/router/index.ts` : ルート定義(旧 app/ 配下の対応表をコメントで記載)
