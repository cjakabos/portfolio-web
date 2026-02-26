/** @type {import('tailwindcss').Config} */
export default {
  // Prefer class-based dark mode for broad Tailwind version compatibility.
  darkMode: 'class',
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
    './utils/**/*.{js,ts,jsx,tsx}',
    './types/**/*.{js,ts,jsx,tsx}',
  ],
};
