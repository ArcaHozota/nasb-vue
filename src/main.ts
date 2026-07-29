import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import "./styles/main.css";
import App from "./App.vue";
import router from "./router";
import { queryClient } from "./queryClient";
import { useAuthStore } from "@/stores/auth";

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

app.mount("#app");
