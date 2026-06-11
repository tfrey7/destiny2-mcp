import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import promise from "eslint-plugin-promise";

export default tseslint.config({ ignores: ["dist/"] }, prettier, {
  files: ["src/**/*.ts", "scripts/**/*.ts"],
  extends: [tseslint.configs.base],
  plugins: { promise },
  rules: {
    // After eslint-config-prettier, which disables `curly` wholesale; the
    // `"all"` option doesn't actually conflict with Prettier, so re-enable it.
    curly: ["error", "all"],
    "@typescript-eslint/consistent-type-imports": "error",
    "promise/prefer-await-to-then": "error",
  },
});
