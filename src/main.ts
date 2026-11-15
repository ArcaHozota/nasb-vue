// src/main.ts
import { createApp } from "vue";
import App from "./App.vue";
import { registerPlugins } from "@/plugins";
import { useCsrfStore } from "@/stores/csrf";
import "./styles/main.css";
import "./styles/app.css";

const app = createApp(App);
registerPlugins(app);

// CSRFトークンを最初に取りに行く(旧 providers.tsx)。
// 失敗してもアプリ自体は起動させ、以降の POST/PUT/DELETE で axios の 403 リトライに委ねる
// (初回アクセス時のネットワーク瞬断などを致命傷にしないため)。
useCsrfStore()
  .fetchCsrf()
  .catch((err) => {
    console.error("Failed to fetch initial CSRF token", err);
  });

app.mount("#app");
