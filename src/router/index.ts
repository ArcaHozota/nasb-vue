import { createRouter, createWebHistory } from "vue-router";
import { confirmUnsaved, requireAuth } from "./guards";

// 旧 Next の app/ 配下に対応。(admin) グループは meta.requiresAuth の子ルートにする。
// まだ移植していない画面は PendingView(フェーズ5で差し替え)。
const pending = () => import("@/views/PendingView.vue");

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/home" },
    { path: "/home", component: () => import("@/views/HomeView.vue") },
    { path: "/login", component: pending, meta: { title: "ログイン" } },
    {
      path: "/",
      component: () => import("@/layouts/AdminLayout.vue"),
      meta: { requiresAuth: true },
      children: [
        { path: "mainmenu", component: pending, meta: { title: "メインメニュー" } },
        { path: "hymns", component: pending, meta: { title: "賛美歌一覧" } },
        {
          path: "hymns/random-five",
          component: pending,
          meta: { title: "ランダム検索" },
        },
        { path: "books/add", component: pending, meta: { title: "聖書章節入力" } },
        { path: "personal", component: pending, meta: { title: "個人スペース" } },
        { path: "error", component: () => import("@/views/ErrorView.vue") },
        // 【一時的・開発用】フェーズ4の部品の確認ページ(フェーズ5で削除)
        ...(import.meta.env.DEV
          ? [{ path: "__components", component: () => import("@/views/DevComponentsView.vue") }]
          : []),
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
