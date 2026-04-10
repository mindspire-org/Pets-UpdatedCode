/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    fontFamily: {
      sans: ['Poppins', 'sans-serif'],
    },
    extend: {
      colors: {
        hospital: {
          blue: "#e6f0ff",
          green: "#e9f9ef",
          teal: "#0ea5a6",
        },
      },
    },
  },
  plugins: [],
};
