// src/api/axios.ts
import axios from "axios";
import { useCsrfStore } from "@/stores/csrf";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase();
  if (method && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfStore = useCsrfStore();
    if (csrfStore.tokenValue()) {
      config.headers = config.headers ?? {};
      config.headers[csrfStore.headerName()] = csrfStore.tokenValue();
    }
  }
  return config;
});

// 403（CSRF拒否）時は一度だけトークンを再取得してリトライ
let isRetrying = false;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 403 &&
      !isRetrying &&
      error.config
    ) {
      isRetrying = true;
      try {
        const csrfStore = useCsrfStore();
        await csrfStore.fetchCsrf();
        error.config.headers[csrfStore.headerName()] = csrfStore.tokenValue();
        return api.request(error.config);
      } finally {
        isRetrying = false;
      }
    }

    // 401 + SESSION_INVALIDATED: 別端末でのログインにより、このセッションが
    // サーバー側(JsonExpiredSessionStrategy等)で失効させられた場合。
    // 通常の「未ログイン401」(router guard 側の fetchMe() が処理する) とは区別し、
    // ここでは強制ログアウト専用のメッセージ付きリダイレクトのみを行う。
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      (error.response.data as { error?: string } | undefined)?.error ===
        "SESSION_INVALIDATED"
    ) {
      localStorage.setItem(
        "redirectMessage",
        "別の端末でログインされたため、ログアウトされました。",
      );
      // フルリロードでPinia/Vue Query等のクライアント側状態を丸ごとリセットする。
      // router.push だと axios.ts <-> router <-> stores/auth.ts の循環importを
      // 避けられるという副次的なメリットもある。
      window.location.href = "/home";
      // ページ遷移するので、この先のエラーハンドラ(トースト表示等)は走らせない。
      return new Promise(() => {});
    }

    return Promise.reject(error);
  },
);

export default api;
