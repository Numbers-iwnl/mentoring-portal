import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: "#000623",
          900: "#030b2e",
          850: "#0c1834",
          800: "#172026",
          700: "#33424b"
        },
        champagne: {
          50: "#f8fbfd",
          100: "#e6eef3",
          300: "#c7d8e4",
          500: "#98b2c4",
          700: "#607889"
        },
        ivory: "#f5f7f8",
        ink: "#071018"
      },
      boxShadow: {
        luxury: "0 28px 90px rgba(0,0,0,0.42)",
        soft: "0 16px 45px rgba(6,10,13,0.10)",
        card: "0 1px 2px rgba(7,16,24,0.04), 0 10px 28px rgba(7,16,24,0.07)"
      },
      fontFamily: {
        sans: ["Sora", "Inter", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        display: ["Fraunces", "Georgia", "Times New Roman", "serif"]
      }
    }
  },
  plugins: []
};

export default config;
