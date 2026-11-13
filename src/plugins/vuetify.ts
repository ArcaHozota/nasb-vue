import "vuetify/styles";
import { createVuetify, type ThemeDefinition } from "vuetify";
import { aliases } from "vuetify/iconsets/mdi-svg";
import { mdiByName } from "./icons";
import { MOBILE_BREAKPOINT } from "@/composables/useIsMobile";

// 旧 theme.ts(MUI createTheme) / globals.css の配色を踏襲
const nasbLight: ThemeDefinition = {
  dark: false,
  colors: {
    background: "#ffffff",
    surface: "#ffffff",
    primary: "#800020", // burgundy
    secondary: "#003399",
    success: "#355e3b",
    warning: "#f6c91c",
    info: "#353542",
    error: "#d32f2f",
    sidebar: "#111827", // サイドバー・上部バー(旧 --sidebar / bg-gray-900)
  },
};

export default createVuetify({
  // アイコン: "mdi-xxx" は plugins/icons.ts の SVG、Vuetify 内部のアイコン($close 等)は mdi-svg の別名
  icons: { defaultSet: "mdi", aliases, sets: { mdi: mdiByName } },
  // useDisplay().mobile を「768px 未満」にする(旧 Tailwind の md と同じ境目)
  display: { mobileBreakpoint: MOBILE_BREAKPOINT },
  theme: {
    // Vuetify 4 の既定は "system"。このアプリはライト固定。
    defaultTheme: "nasbLight",
    themes: { nasbLight },
  },
  defaults: {
    VBtn: { class: "text-none" },
  },
});
