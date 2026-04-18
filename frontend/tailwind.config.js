/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './src/**/*.{js,jsx,ts,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                'bg': '#0A0A0A',
                'secondary': '#111111',
                'accent': '#7B61FF',
                'cyan': '#00D1FF',
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
                'spin-slow': 'spin 20s linear infinite',
            },
            keyframes: {
                float: {
                    '0%,100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-20px)' },
                },
                glow: {
                    '0%': { boxShadow: '0 0 20px rgba(123,97,255,0.3)' },
                    '100%': { boxShadow: '0 0 50px rgba(123,97,255,0.7), 0 0 80px rgba(0,209,255,0.25)' },
                },
            },
        },
    },
    plugins: [],
}