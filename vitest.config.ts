import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// ユニットテスト(Vitest)。nasb-next の vitest.config.ts と同じ設定。
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // 既定は Node。DOM が必要なファイルだけ先頭の `// @vitest-environment jsdom` で切り替える
    environment: "node",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
  },
});
