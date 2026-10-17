import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  { ignores: [".next/**", ".next-preview/**", ".open-next/**", "node_modules/**", ".wrangler/**", "next-env.d.ts", "cloudflare-env.d.ts", "design/**", "_tmp/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
