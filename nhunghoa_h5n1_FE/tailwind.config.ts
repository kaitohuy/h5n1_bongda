import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-start": "var(--bg-gradient-start)",
        "bg-end": "var(--bg-gradient-end)",
        foreground: "var(--foreground)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-red": "var(--accent-red)",
        "accent-red-hover": "var(--accent-red-hover)",
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
        "header-bg": "var(--header-bg)",
        "header-btn-bg": "var(--header-btn-bg)",
        "header-btn-hover": "var(--header-btn-hover)",
        "subnav-bg": "var(--subnav-bg)",
        "border-theme": "var(--border)",
        border: "var(--border)",
        background: "var(--surface)",
        "logo-text-primary": "var(--logo-text-primary)",
        "logo-text-secondary": "var(--logo-text-secondary)",
        "logo-text-accent": "var(--logo-text-accent)",
        "mc-bg-start": "var(--mc-bg-start)",
        "mc-bg-end": "var(--mc-bg-end)",
        "mc-hover-bg": "var(--mc-hover-bg)",
        "mc-hover-border": "var(--mc-hover-border)",
        "logo-bg": "var(--logo-bg)",
        hot: "var(--hot)",
        "hot-hover": "var(--hot-hover)",
        "hot-bg": "var(--hot-bg)",
        "hot-border": "var(--hot-border)",
      },
    },
  },
  plugins: [],
};

export default config;
