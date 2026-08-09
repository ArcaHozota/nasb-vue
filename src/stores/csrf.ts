// src/stores/csrf.ts
import { ref } from "vue";
import { defineStore } from "pinia";
import axios from "axios";
import { EMPTY_STRING } from "@/constants";

type CsrfToken = {
  token: string;
  headerName: string;
  parameterName: string;
} | null;

export const useCsrfStore = defineStore("csrf", () => {
  const csrf = ref<CsrfToken>(null);
  const headerName = () => csrf.value?.headerName ?? "X-CSRF-TOKEN";
  const tokenValue = () => csrf.value?.token ?? EMPTY_STRING;

  const fetchCsrf = async (): Promise<void> => {
    // axios直接使用: api.tsのinterceptorが未取得トークンに依存しないようにするため
    const { data } = await axios.get<CsrfToken>(
      `${import.meta.env.VITE_API_BASE_URL}/csrf`,
      { withCredentials: true },
    );
    csrf.value = data;
  };

  return { csrf, headerName, tokenValue, fetchCsrf };
});
