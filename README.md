# NASB1995 フロントエンド (Vite + Vue 3 + TypeScript + Vuetify 4)

NASB1995 の新フロントエンド v1.1。旧フロントエンド(Next.js + shadcn/ui の nasb-next)の後継で、業務ロジックを引き継ぎ、画面は Vuetify 4 の部品で作る。

Bun 1.4.5 と Node.js を使用する。Bun が未導入の場合は `npm install -g bun@1.4.5` で導入できる。

- `bun install --frozen-lockfile` : `bun.lock` に従って依存関係を導入
- `bun run dev` : 開発サーバー(`/api` は `http://localhost:8277` へプロキシ)
- `bun run build` : `vue-tsc -b` で型チェック後、`dist/` に静的ファイルを生成
- `bun run test` : ユニットテスト(Vitest。`bun run test:watch` で監視。`bun test` は Bun 自身のテストランナーなので使わない)
- `bun run lint` : ESLint(Vue 推奨 + TypeScript)
- `bun run e2e` : 画面を通したテスト(Playwright。nasb-next の e2e/ と同じ。`/api/**` はブラウザ側で差し替えるのでバックエンド不要)
- `docker build .` : nginx で静的配信(ポート3000、SPAフォールバック付き)

## 設計書

- [総合設計書](docs/DesignDocument.md) : 要件・画面と遷移・構成・API・テスト・インフラ
- [画面デザインの決まり](docs/UIGuidelines.md) : 配色・文字・大きさ・部品の見た目
