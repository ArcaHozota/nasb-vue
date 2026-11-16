# NASB1995 フロントエンド (Vite + Vue 3 + TypeScript + Vuetify 4)

Next.js + shadcn/ui 版(nasb-next)からの移行先。業務ロジックは nasb-next と同じで、UIは Vuetify に統一(Tailwind は使わない)。

- `pnpm install`(パッケージ管理は pnpm。`npm` では入れない)
- `pnpm dev` : 開発サーバー(`/api` は `http://localhost:8277` へプロキシ)
- `pnpm build` : `vue-tsc -b` で型チェック後、`dist/` に静的ファイルを生成
- `pnpm test` : ユニットテスト(Vitest。`pnpm test:watch` で監視)
- `pnpm lint` : ESLint(Vue 推奨 + TypeScript)
- `pnpm e2e` : 画面を通したテスト(Playwright。nasb-next の e2e/ と同じ。`/api/**` はブラウザ側で差し替えるのでバックエンド不要)
- `docker build .` : nginx で静的配信(ポート3000、SPAフォールバック付き)

## 設計書

- [総合設計書](docs/DesignDocument.md) : 要件・画面と遷移・構成・API・テスト・インフラ
- [画面デザインの決まり](docs/UIGuidelines.md) : 配色・文字・大きさ・部品の見た目
