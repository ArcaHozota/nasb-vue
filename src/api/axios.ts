// src/api/axios.ts
import axios from "axios";
import { useCsrfStore } from "@/stores/csrf";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
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
    return Promise.reject(error);
  },
);

export default api;
