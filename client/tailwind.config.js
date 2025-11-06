/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#00df9a",
          dark: "#00b87a"
        },
        bg: "#0b0f13",
        panel: "#11161d"
      },
      boxShadow: {
        soft: "0 10px 20px rgba(0,0,0,0.3)"
      },
      borderRadius: {
        '2xl': '1rem'
      }
    },
  },
  plugins: [],
}
