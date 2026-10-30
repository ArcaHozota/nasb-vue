import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";
import { createVuetify, type ThemeDefinition } from "vuetify";

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
  },
};

export default createVuetify({
  theme: {
    // Vuetify 4 の既定は "system"。このアプリはライト固定。
    defaultTheme: "nasbLight",
    themes: { nasbLight },
  },
  defaults: {
    VBtn: { class: "text-none" },
  },
});
