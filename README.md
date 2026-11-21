# NASB1995 フロントエンド (Vite + Vue 3 + TypeScript + Vuetify 4)

NASB1995 の新フロントエンド v1.1。旧フロントエンド(Next.js + shadcn/ui の nasb-next)の後継で、業務ロジックを引き継ぎ、画面は Vuetify 4 の部品で作る。

Docker のビルドと同じ Node.js 22 系（22.22.2 以降）と Corepack を用意し、`corepack enable yarn` を実行する。Corepack が付属しない環境では先に `npm install -g corepack` で導入する。プロジェクト内で `yarn --version` が `package.json` の指定と一致することを確認する。Yarn 1 が優先される場合は `corepack yarn` で指定されたバージョンを起動できる。

- `yarn install --immutable` : `yarn.lock` に従って依存関係を `node_modules` に導入
- `yarn dev` : 開発サーバー（`/api` は `http://localhost:8277` へプロキシ）
- `yarn build` : `vue-tsc -b` で型チェック後、`dist/` に静的ファイルを生成
- `yarn test` : ユニットテスト（Vitest。`yarn test:watch` で監視）
- `yarn lint` : ESLint（Vue 推奨 + TypeScript）
- `yarn exec playwright install chromium` : E2E 用のブラウザを導入
- `yarn e2e` : Playwright で画面をテスト（API はブラウザ側で差し替えるためバックエンド不要）
- `docker build .` : nginx で静的配信(ポート3000、SPAフォールバック付き)

## 設計書

- [総合設計書](docs/DesignDocument.md) : 要件・画面と遷移・構成・API・テスト・インフラ
- [画面デザインの決まり](docs/UIGuidelines.md) : 配色・文字・大きさ・部品の見た目
