import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F5F3EE",
        ink: "#1F2A2E",
        slate: {
          650: "#3A4A52",
        },
        rust: {
          DEFAULT: "#C4622D",
          light: "#E8A26A",
        },
        moss: "#3F6B4F",
        wheat: "#D8CBA9",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "tag-lines":
          "repeating-linear-gradient(90deg, currentColor 0, currentColor 1px, transparent 1px, transparent 6px)",
      },
    },
  },
  plugins: [],
};

export default config;
