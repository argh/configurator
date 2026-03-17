import stylistic from "@stylistic/eslint-plugin";
import jsdoc from "eslint-plugin-jsdoc";

export default [
  stylistic.configs["disable-legacy"],
  jsdoc.configs['flat/recommended'],
  {
    ignores: [
      "**/node_modules/",
      //"test/",
      "docs-output/",
      "benchmark/",
      "coverage/",
      "dev-scripts/"
    ],
  },
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module"
    },
    plugins: {
      "@stylistic": stylistic,
      jsdoc
    },
    rules: {
      // Disable semicolon style enforcement - not enforcing style preferences
      "prefer-const": 1,
      "no-unexpected-multiline": "error", // Catch actual ASI hazards
      "jsdoc/tag-lines": 0,
      "jsdoc/reject-any-time": 0,
      "jsdoc/reject-any-type": 0,
      "jsdoc/require-param-description": 0,
      "jsdoc/require-property-description": 0,
      "jsdoc/require-returns-description": 0,
      "jsdoc/no-undefined-types": ["error", {"definedTypes": ["IteratorObject", "PromiseLike"]}],
      "jsdoc/require-jsdoc": [1, {publicOnly: true, minLineCount: 2}],
      "jsdoc/no-defaults": 0
    },
  },
];
