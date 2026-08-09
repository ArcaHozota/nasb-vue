// src/stores/auth.ts
import { computed, ref } from "vue";
import { defineStore } from "pinia";
import axios from "axios";
import api from "@/api/axios";
import { EMPTY_STRING } from "@/constants";
import { useCsrfStore } from "@/stores/csrf";

type User = {
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

  // 元のZustand版は isLoggedIn()/username()/userId() を関数として提供していたが、
  // Piniaでは computed にするのが自然(呼び出し側は `store.isLoggedIn` のように
  // 関数呼び出し無しでアクセスする)。
  const isLoggedIn = computed(() => !!user.value);
  const username = computed(() => user.value?.username ?? EMPTY_STRING);
  // 元の実装に合わせ、未ログイン時は null ではなく EMPTY_STRING を返す。
  const userId = computed(() => user.value?.id ?? EMPTY_STRING);

  const hasRole = (role: string): boolean =>
    user.value?.roles?.includes(role) ?? false;

  const fetchMe = async (): Promise<User> => {
    try {
      // Scala側は { id: string, username: string } を返す(roles無し)。
      const { data } = await api.get<{ id: string; username: string }>("/me");
      const fetched: User = {
        id: data.id,
        username: data.username,
        roles: [],
      };
      user.value = fetched;
      return fetched;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        user.value = null;
        return null;
      }
      throw err;
    }
  };

  const logout = async (): Promise<void> => {
    await api.post("/logout");
    user.value = null;
    const csrfStore = useCsrfStore();
    await csrfStore.fetchCsrf(); // 新しいトークンを取得しておく
  };

  const login = async (username: string, password: string): Promise<void> => {
    const body = new URLSearchParams({ username, password });
    const { data } = await api.post<{ message?: string }>("/login", body);
    if (data?.message) {
      localStorage.setItem("redirectMessage", data.message);
    }
    await fetchMe();
    // セッションローテーションでCSRFトークンが変わっている可能性があるため再取得
    const csrfStore = useCsrfStore();
    await csrfStore.fetchCsrf();
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
  };
});
