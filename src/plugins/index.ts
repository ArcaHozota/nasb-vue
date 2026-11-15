// src/plugins/index.ts
// プラグインをまとめて登録する(Vuetify のひな形 create-vuetify と同じ形)。
// Pinia を先に登録する(ルーターのガードや axios のインターセプターがストアを使うため)。
import type { App } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import router from "@/router";
import vuetify from "./vuetify";
import { queryClient } from "./queryClient";
import "./fonts";

export function registerPlugins(app: App) {
  app
    .use(createPinia())
    .use(router)
    .use(vuetify)
    .use(VueQueryPlugin, { queryClient });
}
