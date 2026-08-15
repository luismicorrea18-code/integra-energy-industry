/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        primary: '#6DC82A',
        'primary-dark': '#55A020',
        secondary: '#1AADB8',
        'secondary-dark': '#148A96',
        accent: '#F5921E',
        'accent-dark': '#D07010',
        navy: '#1B2F6E',
        surface: '#F8FAFC',
        foreground: '#1E293B',
        muted: '#EBF0F5',
        border: '#E2E8F0',
        destructive: '#DC2626',
        ink: '#06120E'
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -8px rgba(15,23,42,0.10)',
        'card-hover': '0 4px 10px rgba(15,23,42,0.06), 0 16px 32px -10px rgba(15,23,42,0.16)'
      }
    }
  },
  plugins: []
}
