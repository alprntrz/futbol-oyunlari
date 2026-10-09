import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // server.js is a plain CommonJS Node entry point (not bundled by Next).
    files: ["server.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // Client components read localStorage / navigator in a mount effect and
    // then set state. That is deliberate: reading them during render would make
    // the server HTML differ from the first client render (hydration mismatch).
    // Kept visible as a warning rather than an error.
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
