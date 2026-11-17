import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";

// 旧 next.config.ts の rewrites 相当:
// 開発時のみ /api を剥がしてバックエンド(localhost:8277)へ転送する。
// 本番は前段(nginx/CloudFront等)が /api をバックエンドへ直接ルーティングする。
export default defineConfig({
  plugins: [
    {
      name: "fontsource-woff2-only",
      enforce: "pre",
      transform(css, id) {
        const path = id.replace(/\?.*$/, "").replaceAll("\\", "/");
        if (
          !path.includes("/node_modules/@fontsource/") ||
          !path.endsWith(".css")
        )
          return;
        // 配信形式を WOFF2 に統一し、同じ字形の WOFF を重複して生成しない。
        // Fontsource の unicode-range・ウェイトはそのまま保持する。
        return {
          code: css.replace(/,\s*url\([^)]*\)\s*format\(['"]woff['"]\)/g, ""),
          map: null,
        };
      },
    },
    vue(),
    vuetify({
      autoImport: true,
      styles: { configFile: "src/styles/settings.scss" },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8277",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
