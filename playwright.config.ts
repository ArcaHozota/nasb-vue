import { defineConfig, devices } from "@playwright/test";

// 画面を通したテスト(E2E)。nasb-next の e2e/ をそのまま移植したもの。
// バックエンドは起動せず、ブラウザ側で /api/** の応答を差し替える(e2e/mock-api.ts)。
// 本番と同じビルド結果(dist/)を vite preview で配信して確かめる。
const PORT = 3100;
const START = `npx vite preview --port ${PORT} --strictPort`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI では build 済みのものを起動するだけにする(ワークフローで先に npm run build する)
    command: process.env.CI ? START : `npm run build && ${START}`,
    url: `http://localhost:${PORT}/home`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
