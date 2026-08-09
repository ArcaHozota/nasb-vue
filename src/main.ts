import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import "./styles/main.css";
import App from "./App.vue";
import router from "./router";
import { queryClient } from "./queryClient";
import { useAuthStore } from "@/stores/auth";
import { useCsrfStore } from "@/stores/csrf";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(VueQueryPlugin, { queryClient });

// 旧 layouts/AdminLayout.tsx の
//   window.addEventListener("auth:unauthorized", () => location.href = "/home")
// 相当。SPAなのでフルリロードではなく router.push で遷移させる。
window.addEventListener("auth:unauthorized", () => {
  const auth = useAuthStore();
  auth.$patch({ user: null });
  router.push("/home");
});

// CSRFトークンをマウント前に確定させておく。
// 失敗してもアプリ自体は起動させ、以降のPOST/PUT/DELETEでresponse interceptor側の
// 403リトライに委ねる(初回アクセス時のネットワーク瞬断などを致命傷にしないため)。
(async () => {
  const csrfStore = useCsrfStore();
  try {
    await csrfStore.fetchCsrf();
  } catch (err) {
    console.error("Failed to fetch initial CSRF token", err);
  }
  app.mount("#app");
})();
