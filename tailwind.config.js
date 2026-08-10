/** @type {import('tailwindcss').Config} */
// const flowbite = require("flowbite-react/tailwind");

module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/flowbite/**/*.js",
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
    },
  },
  plugins: [require("flowbite/plugin")],
};