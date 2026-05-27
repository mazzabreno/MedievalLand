import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Press Start 2P"', "monospace"],
      },
      colors: {
        parchment: "#e8d5a3",
        "dark-wood": "#3d1f00",
      },
    },
  },
  plugins: [],
};

export default config;
