# NASB1995 フロントエンド (Vite + Vue 3 + TypeScript + Vuetify 4)

Next.js + shadcn/ui 版(nasb-next)からの移行先。業務ロジックは nasb-next と同じで、UIは Vuetify に統一(Tailwind は使わない)。

- `npm install`
- `npm run dev` : 開発サーバー(`/api` は `http://localhost:8277` へプロキシ)
- `npm run build` : `vue-tsc` で型チェック後、`dist/` に静的ファイルを生成
- `npm test` : ユニットテスト(Vitest。`npm run test:watch` で監視)
- `npm run lint` : ESLint(Vue 推奨 + TypeScript)
- `docker build .` : nginx で静的配信(ポート3000、SPAフォールバック付き)

## 構成
- `src/plugins/vuetify.ts` : テーマ(primary #800020 / secondary #003399 / success #355e3b / warning #f6c91c / info #353542 / error #d32f2f / sidebar #111827、ライト固定)。モバイル判定の境目は 768px
- `src/plugins/icons.ts` : アイコン。`@mdi/js` の SVG を使い、使うものだけをバンドルする。テンプレートは `mdi-xxx` の名前で書き、新しいアイコンは `ICONS` に1行足す
- `src/plugins/fonts.ts` : Fontsource で Noto Sans JP / Noto Serif JP / Noto Serif KR / Niconne を自前配信
- `src/styles/settings.scss` : Vuetify の Sass 変数(本文フォント)
- `src/styles/app.css` : 画面固有のクラス(ガラスカード・赤字エディタ・開いた讃美歌集など。旧 globals.css)
- `src/router/` : ルート定義と全体ガード(ログイン確認・未保存の確認)
- `src/api/` `src/lib/` : 通信・業務ロジック(nasb-next からそのまま移植。テスト付き)
- `src/stores/` : Pinia(auth / csrf / feedback / unsavedGuard)
- `src/composables/` : 旧 hooks(useDebouncedValue / useUnsavedChanges / usePlaylistCreation / useIsMobile / useSessionCheck)

## 文字サイズのクラス
Vuetify 4 は Material Design 3 の名前になっている(`text-h6` などは無い)。
`text-title-large` / `text-title-medium` / `text-body-medium` / `text-body-small` / `text-headline-medium` などを使う。
