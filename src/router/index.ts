import { createRouter, createWebHistory } from "vue-router";

// 旧 Next の app/ 配下に対応。(admin) グループは meta.requiresAuth の子ルートにする。
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/home" },
    { path: "/home", component: () => import("@/views/HomeView.vue") },
    // { path: "/login", component: () => import("@/views/LoginView.vue") },
    // {
    //   path: "/",
    //   component: () => import("@/layouts/AdminLayout.vue"),
    //   meta: { requiresAuth: true },
    //   children: [ /* mainmenu, hymns, hymns/add, hymns/edit, hymns/random-five, books/add, personal, error */ ],
    // },
  ],
});

export default router;
