import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f6f4",
          100: "#e8e7e1",
          200: "#d3d1c7",
          400: "#888780",
          600: "#5f5e5a",
          800: "#2c2c2a",
          900: "#1a1a19",
        },
        accent: {
          50: "#e6f1fb",
          100: "#b5d4f4",
          400: "#378add",
          600: "#185fa5",
          800: "#0c447c",
        },
        live: {
          on: "#0f6e56",
          warn: "#854f0b",
          off: "#a32d2d",
        },
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-in": "fade-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
