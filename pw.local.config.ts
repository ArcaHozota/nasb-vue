import base from "./playwright.config";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  ...base,
  reporter: "list",
  use: { ...base.use, launchOptions: { executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-mac-arm64/chrome-headless-shell` } },
});
