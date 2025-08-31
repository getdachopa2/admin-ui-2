/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Ana palet: yeşil
        primary: {
          DEFAULT: "#059669",     // emerald-600
          fg: "#ffffff"
        },
        // Nötr koyu gri set (UI background)
        base: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          850: "#1f1f1f",
          900: "#171717",
          950: "#0a0a0a"
        }
      },
      borderRadius: {
        "xl": "0.75rem",
        "2xl": "1rem"
      },
      boxShadow: {
        soft: "0 8px 24px -8px rgba(0,0,0,0.5)"
      }
    }
  },
  plugins: []
};
