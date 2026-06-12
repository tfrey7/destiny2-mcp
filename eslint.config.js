import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import promise from "eslint-plugin-promise";
import unicorn from "eslint-plugin-unicorn";

export default tseslint.config({ ignores: ["dist/", "release/"] }, prettier, {
  files: ["src/**/*.ts", "scripts/**/*.ts"],
  extends: [tseslint.configs.base],
  plugins: { promise, unicorn },
  rules: {
    "unicorn/filename-case": ["error", { case: "snakeCase" }],
    // After eslint-config-prettier, which disables `curly` wholesale; the
    // `"all"` option doesn't actually conflict with Prettier, so re-enable it.
    curly: ["error", "all"],
    "@typescript-eslint/consistent-type-imports": "error",
    "promise/prefer-await-to-then": "error",
    // Require a blank line after a variable-declaration group before the next
    // statement, but allow consecutive declarations to stay grouped.
    "padding-line-between-statements": [
      "error",
      { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
      { blankLine: "any", prev: ["const", "let", "var"], next: ["const", "let", "var"] },
      // Require a blank line after a block (guard clauses, loops, etc.) before
      // the next statement.
      { blankLine: "always", prev: "multiline-block-like", next: "*" },
    ],
  },
});
