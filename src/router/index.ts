import { createRouter, createWebHistory } from "vue-router";
import { confirmUnsaved, requireAuth } from "./guards";

// 旧 Next の app/ 配下に対応。(admin) グループは meta.requiresAuth の子ルートにする。
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/home" },
    { path: "/home", component: () => import("@/views/HomeView.vue") },
    { path: "/login", component: () => import("@/views/LoginView.vue") },
    {
      path: "/",
      component: () => import("@/layouts/AdminLayout.vue"),
      meta: { requiresAuth: true },
      children: [
        {
          path: "mainmenu",
          component: () => import("@/views/MainMenuView.vue"),
        },
        { path: "hymns", component: () => import("@/views/HymnListView.vue") },
        {
          path: "hymns/random-five",
          component: () => import("@/views/RandomFiveView.vue"),
        },
        {
          path: "books/add",
          component: () => import("@/views/BookAdditionView.vue"),
        },
        {
          path: "personal",
          component: () => import("@/views/PersonalView.vue"),
        },
        { path: "error", component: () => import("@/views/ErrorView.vue") },
      ],
    },
    {
      path: "/:pathMatch(.*)*",
      component: () => import("@/views/NotFoundView.vue"),
    },
  ],
});

// 先に未保存の確認(断られたらログイン確認の通信もしない)、次にログイン確認
router.beforeEach(confirmUnsaved);
router.beforeEach(requireAuth);

export default router;
