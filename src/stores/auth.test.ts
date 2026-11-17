import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
vi.mock("@/api/axios", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from "@/api/axios";
import { useAuthStore } from "./auth";
import { useCsrfStore } from "./csrf";

describe("ログアウト", () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.resetAllMocks(); });
  const setup = () => {
    const auth = useAuthStore(), csrf = useCsrfStore();
    auth.user = { id: "1", username: "user", roles: [] };
    csrf.csrf = { token: "token", headerName: "X-CSRF-TOKEN", parameterName: "_csrf" };
    return { auth, csrf };
  };
  it("成功後は本人・トークンを消し、追加のCSRF取得に依存しない", async () => {
    const { auth, csrf } = setup();
    vi.mocked(api.post).mockResolvedValue({ data: "" });
    vi.mocked(api.get).mockRejectedValue(new Error("CSRF unavailable"));
    await auth.logout();
    expect(auth.user).toBeNull();
    expect(csrf.csrf).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });
  it("ログアウト要求が失敗したときは、再試行できるよう本人・トークンを保持する", async () => {
    const { auth, csrf } = setup();
    vi.mocked(api.post).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: "" });
    await expect(auth.logout()).rejects.toThrow("offline");
    expect(auth.isLoggedIn).toBe(true);
    expect(csrf.tokenValue()).toBe("token");
    await auth.logout();
    expect(auth.isLoggedIn).toBe(false);
  });
});
