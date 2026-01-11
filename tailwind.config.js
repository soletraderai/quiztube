/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neobrutalism color palette
        primary: '#FFDE59',      // Electric yellow
        secondary: '#00D4FF',    // Cyan accent
        background: '#FFFEF0',   // Off-white
        surface: '#FFFFFF',      // White cards
        text: '#1A1A1A',         // Near black
        border: '#000000',       // Pure black borders
        success: '#00FF85',      // Bright green
        error: '#FF4444',        // Bright red
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'brutal': '4px 4px 0 0 #000000',
        'brutal-hover': '6px 6px 0 0 #000000',
        'brutal-sm': '2px 2px 0 0 #000000',
      },
      borderWidth: {
        '3': '3px',
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'check-draw': {
          '0%': { strokeDasharray: '0 100' },
          '100%': { strokeDasharray: '100 0' },
        },
        'pulse-subtle': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        'ping-slow': {
          '0%': { transform: 'scale(1)', opacity: '0.3' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-up': 'slide-up 0.4s ease-out forwards',
        'check-draw': 'check-draw 0.5s ease-out 0.2s forwards',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
        'ping-slow': 'ping-slow 1.5s ease-out infinite',
      },
    },
  },
  plugins: [],
}
