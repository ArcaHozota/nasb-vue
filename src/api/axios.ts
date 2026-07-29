// src/api/axios.ts
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

// CSRF対策は SESSION_ID Cookie を
//   isHttpOnly = true, isSecure = true, sameSite = Cookie.SameSite.Strict
// として発行することで代替している(Scala/ZIO側 CommonRoutes.scala に準拠)。
// 未認証(401)はそのままログイン画面へのリダイレクトに使う。
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    return Promise.reject(err);
  },
);

export default api;
