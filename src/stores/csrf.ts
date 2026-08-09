// src/stores/csrf.ts
import { ref } from "vue";
import { defineStore } from "pinia";
import api from "@/api/axios";
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
    const { data } = await api.get<CsrfToken>("/csrf");
    csrf.value = data;
  };

  return { csrf, headerName, tokenValue, fetchCsrf };
});
