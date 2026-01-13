import stylistic from "@stylistic/eslint-plugin";

export default [
  stylistic.configs["disable-legacy"],
  {
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      // Disable semicolon style enforcement - not enforcing style preferences
      "prefer-const": "error",
      "no-unexpected-multiline": "error", // Catch actual ASI hazards
    },
  },
];
