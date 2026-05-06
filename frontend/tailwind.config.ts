import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0e0e0f",
          surface: "#19191b",
          elevated: "#1f1f22",
          lowest: "#131315",
          border: "#48484b",
        },
        accent: {
          DEFAULT: "#c6c6c8",
          blue: "#64c8ff",
          magenta: "#c677dd",
          teal: "#00ffc8",
        },
        text: {
          primary: "#e7e5e8",
          secondary: "#acaaae",
          muted: "#767578",
        },
        success: "#6ee7b7",
        danger: "#ee7d77",
      },
      fontFamily: {
        manrope: ['"Manrope"', "sans-serif"],
        sans: ['"Manrope"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
