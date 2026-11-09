import type { Config } from "tailwindcss";

/**
 * Tokens da identidade Digitusul (cores do logotipo oficial: azul #2341C1 e vermelho #E61F27).
 * Neutros, superfícies e tons claros da marca vêm de variáveis CSS (globals.css), que
 * mudam entre o modo claro (tons azulados da marca) e o modo escuro (azul-marinho).
 */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (prefix: string, steps: number[]) => Object.fromEntries(steps.map((s) => [s, v(`${prefix}-${s}`)]));

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zinc: scale("zinc", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        surface: v("surface"),
        page: v("page"),
        brand: {
          ...scale("brand", [50, 100, 200, 300, 700, 800]),
          400: "#5F78DF", 500: "#3A57D2", 600: "#2341C1", 900: "#142462", 950: "#0B1A4A",
        },
        accent: { 50: v("accent-50"), 500: "#E61F27", 600: "#C8151D", 700: v("accent-700") },
        ink: { DEFAULT: v("ink"), soft: v("ink-soft"), muted: v("ink-muted") },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / .05)",
        pop: "0 16px 40px -16px rgb(var(--shadow) / .28), 0 0 0 1px rgb(var(--shadow) / .05)",
      },
    },
  },
  plugins: [],
};
export default config;
