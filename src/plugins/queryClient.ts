import { QueryClient } from "@tanstack/vue-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30秒間は新鮮とみなす
      retry: 1, // 認証エラーで無駄に連打しない
    },
  },
});
