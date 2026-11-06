import type { Config } from "tailwindcss";

/** Tokens da identidade Digitusul — manter em sincronia com src/modules/flyer-studio/domain/brand.ts (cores do logotipo oficial) */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEF1FC", 100: "#DCE2F9", 200: "#B9C5F3", 300: "#8EA0EA", 400: "#5F78DF",
          500: "#3A57D2", 600: "#2341C1", 700: "#1C34A0", 800: "#182C80", 900: "#142462", 950: "#0B1A4A",
        },
        accent: { 50: "#FDECEC", 500: "#E61F27", 600: "#C8151D", 700: "#A11017" },
        ink: { DEFAULT: "#0F172A", soft: "#334155", muted: "#64748B" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Montserrat", "Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)",
        pop: "0 10px 30px -10px rgba(15,23,42,.25)",
      },
    },
  },
  plugins: [],
};
export default config;
