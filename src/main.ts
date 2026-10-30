import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import App from "./App.vue";
import router from "./router";
import vuetify from "./plugins/vuetify";
import { queryClient } from "./plugins/queryClient";
import "./plugins/fonts";
import "./styles/main.css";

createApp(App)
  .use(createPinia())
  .use(router)
  .use(vuetify)
  .use(VueQueryPlugin, { queryClient })
  .mount("#app");
