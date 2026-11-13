import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import App from "./App.vue";
import router from "./router";
import vuetify from "./plugins/vuetify";
import { queryClient } from "./plugins/queryClient";
import { useCsrfStore } from "./stores/csrf";
import "./plugins/fonts";
import "./styles/main.css";
import "./styles/app.css";

const app = createApp(App);
// Pinia を先に登録する(ルーターのガードや axios のインターセプターがストアを使うため)
app.use(createPinia());

// CSRFトークンを最初に取りに行く(旧 providers.tsx)。
// 失敗してもアプリ自体は起動させ、以降の POST/PUT/DELETE で axios の 403 リトライに委ねる
// (初回アクセス時のネットワーク瞬断などを致命傷にしないため)。
useCsrfStore()
  .fetchCsrf()
  .catch((err) => {
    console.error("Failed to fetch initial CSRF token", err);
  });

app.use(router).use(vuetify).use(VueQueryPlugin, { queryClient }).mount("#app");
