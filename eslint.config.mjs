import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Project rule: no em dash (U+2014) in UI strings. See docs/REQUISITOS.md RN-81.
const EM_DASH = "/\\u2014/";
const noEmDashMessage = "Não use travessão em textos. Use ponto, vírgula, dois pontos ou ' · '.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${EM_DASH}]`, message: noEmDashMessage },
        { selector: `TemplateElement[value.raw=${EM_DASH}]`, message: noEmDashMessage },
        { selector: `JSXText[value=${EM_DASH}]`, message: noEmDashMessage },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "components/brand/logo-r-path.ts",
  ]),
]);

export default eslintConfig;
