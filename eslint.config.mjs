import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-demo/**",
      "fact/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["e2e/**/*.js", "e2e-demo/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["**/*.{js,mjs,jsx}"],
    languageOptions: { ecmaVersion: "latest", globals: { ...globals.node } },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
  {
    files: ["Frontend/my_app/{src,demo}/**/*.{js,jsx}"],
    languageOptions: {
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": hooks },
    rules: {
      "react/jsx-uses-vars": "error",
      "react/jsx-no-undef": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
];
