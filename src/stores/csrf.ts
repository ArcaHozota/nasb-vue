// src/stores/csrf.ts
import { defineStore } from "pinia";
import { ref } from "vue";
import api from "@/api/axios";
import { EMPTY_STRING } from "@/lib/constants";

export type CsrfToken = {
  token: string;
  headerName: string;
  parameterName: string;
} | null;

// axios.ts のインターセプター(モジュールスコープ、コンポーネント外)からも
// useCsrfStore() で直接読み書きできる(app.use(pinia) 済みであれば)。
export const useCsrfStore = defineStore("csrf", () => {
  const csrf = ref<CsrfToken>(null);

  const headerName = () => csrf.value?.headerName ?? "X-CSRF-TOKEN";
  const tokenValue = () => csrf.value?.token ?? EMPTY_STRING;

  async function fetchCsrf() {
    const { data } = await api.get<CsrfToken>("/common/csrf");
    csrf.value = data;
  }

  return { csrf, headerName, tokenValue, fetchCsrf };
});
