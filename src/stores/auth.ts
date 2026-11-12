// src/stores/auth.ts
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import axios from "axios";
import api from "@/api/axios";
import { EMPTY_STRING } from "@/lib/constants";
import { useCsrfStore } from "@/stores/csrf";
import { REDIRECT_MESSAGE_KEY } from "@/lib/session";

export type User = {
  id: string;
  username: string;
  // 【要確認】Scala側 CommonRoutes.scala の "me" ハンドラは現状
  //   Map("id" -> session.userId.toString, "username" -> session.userName)
  // しか返しておらず、authorities/roles は含まれていない。
  // そのため roles は常に空配列になり、hasRole(...) は常に false を返す。
  roles: string[];
} | null;

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User>(null);

  const isLoggedIn = computed(() => !!user.value);
  const username = computed(() => user.value?.username ?? EMPTY_STRING);
  // 元の実装に合わせ、未ログイン時は null ではなく EMPTY_STRING を返す。
  const userId = computed(() => user.value?.id ?? EMPTY_STRING);

  const hasRole = (role: string): boolean =>
    user.value?.roles?.includes(role) ?? false;

  async function fetchMe(): Promise<User> {
    try {
      // Scala側は { id: string, username: string } を返す(roles無し)。
      const { data } = await api.get<{ id: string; username: string }>(
        "/common/me",
      );
      user.value = { id: data.id, username: data.username, roles: [] };
      return user.value;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        user.value = null;
        return null;
      }
      throw err;
    }
  }

  async function logout(): Promise<void> {
    await api.post("/logout");
    user.value = null;
    await useCsrfStore().fetchCsrf(); // 新しいトークンを取得しておく
  }

  async function login(username: string, password: string): Promise<void> {
    const body = new URLSearchParams({ username, password });
    const { data } = await api.post<{ message?: string }>("/login", body);
    if (data?.message) {
      localStorage.setItem(REDIRECT_MESSAGE_KEY, data.message);
    }
    await fetchMe();
    // セッションローテーションでCSRFトークンが変わっている可能性があるため再取得
    await useCsrfStore().fetchCsrf();
  }

  const clearUser = () => {
    user.value = null;
  };

  return {
    user,
    isLoggedIn,
    username,
    userId,
    hasRole,
    fetchMe,
    login,
    logout,
    clearUser,
  };
});
