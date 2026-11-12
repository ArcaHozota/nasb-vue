// src/composables/useIsMobile.ts
// 旧 hooks/use-mobile.ts 相当。画面幅の判定は Vuetify の useDisplay() に任せる。
// plugins/vuetify.ts で display.mobileBreakpoint = MOBILE_BREAKPOINT にしてあるので、
// useDisplay().mobile は「768px 未満」で true になる(旧 Tailwind の md と同じ境目)。
import { computed } from "vue";
import { useDisplay } from "vuetify";

/** モバイルとみなす画面幅の境目(旧 Tailwind の md と同じ)。サイドバー・ホームで共通 */
export const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const { mobile } = useDisplay();
  return computed(() => mobile.value);
}
