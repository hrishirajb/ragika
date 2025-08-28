/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        sidebar: '#202123',
        chatBg: '#343541',
        assistant: '#444654',
        user: '#3C3F4E',
        inputBg: '#40414F',
        border: '#3E3F4B'
      }
    }
  },
  plugins: []
};