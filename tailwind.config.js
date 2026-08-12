/** @type {import('tailwindcss').Config} */
module.exports = {
  // ThemeProvider stamps the resolved theme on <html data-theme="...">, so
  // "system" and an explicit choice go through exactly one selector.
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "primary-strong": "rgb(var(--color-primary-strong) / <alpha-value>)",
        "primary-soft": "rgb(var(--color-primary-soft) / <alpha-value>)",
        "primary-contrast": "rgb(var(--color-primary-contrast) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        "success-strong": "rgb(var(--color-success-strong) / <alpha-value>)",
        "success-soft": "rgb(var(--color-success-soft) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        "warning-strong": "rgb(var(--color-warning-strong) / <alpha-value>)",
        "warning-soft": "rgb(var(--color-warning-soft) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        "danger-strong": "rgb(var(--color-danger-strong) / <alpha-value>)",
        "danger-soft": "rgb(var(--color-danger-soft) / <alpha-value>)",
        info: "rgb(var(--color-info) / <alpha-value>)",
        "info-strong": "rgb(var(--color-info-strong) / <alpha-value>)",
        "info-soft": "rgb(var(--color-info-soft) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--color-surface-2) / <alpha-value>)",
        "surface-3": "rgb(var(--color-surface-3) / <alpha-value>)",
        "surface-inverse": "rgb(var(--color-surface-inverse) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        "ink-muted": "rgb(var(--color-ink-muted) / <alpha-value>)",
        "ink-faint": "rgb(var(--color-ink-faint) / <alpha-value>)",
        "ink-inverse": "rgb(var(--color-ink-inverse) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        "border-strong": "rgb(var(--color-border-strong) / <alpha-value>)",
        "focus-ring": "rgb(var(--color-focus-ring) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
        dialog: "var(--shadow-dialog)",
      },
      screens: {
        custom: "1036px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-10px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "60%": { opacity: "1", transform: "scale(1.03)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // Urgency on the last seconds of a question.
        "pulse-urgent": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.08)" },
        },
        // Loading placeholders read as "working", not "broken".
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "bar-grow": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
      },
      animation: {
        "fade-in": "fade-in 220ms ease-out both",
        rise: "rise 260ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in": "slide-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
        pop: "pop 280ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "pulse-urgent": "pulse-urgent 900ms ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
        "bar-grow": "bar-grow 600ms cubic-bezier(0.22, 1, 0.36, 1) both",
        shake: "shake 300ms ease-in-out",
      },
    },
  },
  plugins: [],
};