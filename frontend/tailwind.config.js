/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // This array tells Tailwind which files to scan for Tailwind classes
    // Crucially, this MUST cover all your .js, .jsx, .ts, .tsx files
    "./src/**/*.{js,jsx,ts,tsx}",
    // Also include your public HTML file if you have Tailwind classes there
    "./public/index.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}