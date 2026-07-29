// src/router/index.ts
import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

// 旧 app/(admin)/layout.tsx 配下の画面群。全て要認証(meta.requiresAuth)。
const AdminLayout = () => import("@/layouts/AdminLayout.vue");

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // 旧 app/page.tsx の redirect("/home") 相当
    { path: "/", redirect: "/home" },

    // 旧 app/home, app/login (未認証でも見られる画面)
    {
      path: "/home",
      name: "home",
      component: () => import("@/views/HomeView.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/LoginView.vue"),
    },

    // 旧 app/(admin)/* (要認証)
    {
      path: "/",
      component: AdminLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: "mainmenu",
          name: "mainmenu",
          component: () => import("@/views/MainMenu.vue"),
        },
        {
          path: "hymns",
          name: "hymns",
          component: () => import("@/views/HymnList.vue"),
        },
        {
          path: "hymns/add",
          name: "hymns-add",
          component: () => import("@/views/HymnForm.vue"),
        },
        {
          path: "hymns/edit",
          name: "hymns-edit",
          component: () => import("@/views/HymnForm.vue"),
        },
        {
          path: "hymns/score",
          name: "hymns-score",
          component: () => import("@/views/HymnScore.vue"),
        },
        {
          path: "hymns/random-five",
          name: "hymns-random-five",
          component: () => import("@/views/RandomFive.vue"),
        },
        {
          path: "books/add",
          name: "books-add",
          component: () => import("@/views/BookAddition.vue"),
        },
        {
          path: "personal",
          name: "personal",
          component: () => import("@/views/StudentEdition.vue"),
        },
        {
          path: "error",
          name: "error",
          component: () => import("@/views/ErrorPage.vue"),
        },
      ],
    },
  ],
});

// 旧 layouts/AdminLayout.tsx の
//   useEffect(() => { if (!user) fetchMe().catch(() => location.href = "/home") }, ...)
// 相当。requiresAuth なルートに入る前に必ず認証状態を確定させる。
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true;

  const auth = useAuthStore();
  if (!auth.isLoggedIn) {
    try {
      await auth.fetchMe();
    } catch {
      // 401以外の予期しないエラー。ひとまずホームへ逃がす。
      return { path: "/home" };
    }
  }

  // fetchMe()は401時に例外を投げず user=null を返す実装なので、
  // catch を抜けた後も改めてログイン状態を確認する。
  if (!auth.isLoggedIn) return { path: "/home" };

  return true;
});

export default router;
