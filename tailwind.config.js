/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/client/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        netflix: {
          red: "#E50914",
          "red-hover": "#F40612",
          "red-active": "#C00813",
          black: "#141414",
          "dark-gray": "#1F1F1F",
          charcoal: "#2F2F2F",
          "charcoal-hover": "#353535",
        },
        badge: {
          cyan: "#00D9FF",
          orange: "#FF9500",
          pink: "#FF2D55",
          green: "#34C759",
          purple: "#5E5CE6",
          yellow: "#FFD600",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#B3B3B3",
          tertiary: "#808080",
          disabled: "#565656",
        },
      },
      fontFamily: {
        netflix: [
          "Netflix Sans",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
      },
      animation: {
        "fade-in-up": "fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fadeIn 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-scale": "pulseScale 200ms ease-out",
        shimmer: "shimmer 1.5s infinite",
        "spin-slow": "spin 1s linear infinite",
        "count-up": "countUp 800ms ease-out",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulseScale: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.95)" },
          "75%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        countUp: {
          "0%": { opacity: "0.5", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      boxShadow: {
        card: "0 2px 8px rgba(0, 0, 0, 0.3)",
        "card-hover": "0 12px 24px rgba(0, 0, 0, 0.5)",
        dropdown: "0 8px 24px rgba(0, 0, 0, 0.5)",
        "glow-red": "0 4px 12px rgba(229, 9, 20, 0.4)",
        "glow-badge": "0 0 12px currentColor",
      },
      transitionTimingFunction: {
        "bounce-out": "cubic-bezier(0.4, 0, 0.2, 1)",
        smooth: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
