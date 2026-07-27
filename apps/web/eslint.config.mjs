import preset from "@gigrise/config/eslint-preset.js";

export default [
  ...preset,
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
];
