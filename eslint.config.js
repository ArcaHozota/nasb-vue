// ESLint(flat config)。Vue 公式の推奨設定 + TypeScript。
// nasb-next の eslint.config.mjs(eslint-config-next)に相当する。
import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import globals from "globals";

export default defineConfigWithVueTs(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  pluginVue.configs["flat/recommended"],
  vueTsConfigs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // 見た目の整形は扱わない(Prettier 等の整形ツールに任せる)
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/multiline-html-element-content-newline": "off",
      "vue/html-self-closing": "off",
      "vue/html-indent": "off",
      "vue/html-closing-bracket-newline": "off",
      "vue/first-attribute-linebreak": "off",
      // コンポーネント名は nasb-next と同じにする(Hint / Highlighted など1語のものがある)
      "vue/multi-word-component-names": "off",
      // optional な props(TypeScript の ?)は undefined のままでよい
      "vue/require-default-prop": "off",
      // 全角スペース(「　」)は正規表現・文字列・テンプレートの本文では意図して使っている
      "no-irregular-whitespace": ["error", { skipStrings: true, skipRegExps: true, skipTemplates: true, skipComments: true }],
      // 未使用の引数は _ で始めれば許す
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.vue"],
    rules: {
      "no-irregular-whitespace": "off",
      "vue/no-irregular-whitespace": ["error", { skipStrings: true, skipRegExps: true, skipComments: true, skipHTMLTextContents: true }],
    },
  },
  {
    files: ["*.config.ts", "*.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
);
