import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

export const config = [
  ...nextVitals,
  ...nextTypescript,
  prettier,
  { ignores: [".next/**", "out/**", "next-env.d.ts"] },
];
