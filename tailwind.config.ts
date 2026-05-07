import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      screens: {
        'xs': '480px',
      },
      borderRadius: {
        sm:   "0.375rem",   /* 6px */
        md:   "0.5rem",     /* 8px — badges */
        lg:   "0.75rem",    /* 12px — cards, botões */
        xl:   "0.75rem",    /* 12px — inputs, botões grandes */
        "2xl": "1rem",      /* 16px — modais */
        "3xl": "1.25rem",   /* 20px */
        full: "9999px",
      },
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring:  "hsl(var(--ring) / <alpha-value>)",
        card: {
          DEFAULT:    "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border:     "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border:     "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT:    "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border:     "var(--primary-border)",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border:     "var(--secondary-border)",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border:     "var(--muted-border)",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border:     "var(--accent-border)",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border:     "var(--destructive-border)",
        },
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          ring:       "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT:    "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border:     "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        "sidebar-primary": {
          DEFAULT:    "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border:     "var(--sidebar-primary-border)",
        },
        "sidebar-accent": {
          DEFAULT:    "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border:     "var(--sidebar-accent-border)",
        },
        status: {
          online:  "rgb(34 197 94)",
          away:    "rgb(245 158 11)",
          busy:    "rgb(239 68 68)",
          offline: "rgb(156 163 175)",
        },
      },
      fontFamily: {
        sans:  ["var(--font-sans)"],
        serif: ["Georgia", "serif"],
        mono:  ["var(--font-mono)"],
      },
      boxShadow: {
        "2xs":   "0 1px 3px 0 rgb(32 40 45 / 4%)",
        "xs":    "0 1px 5px 0 rgb(32 40 45 / 6%)",
        "sm":    "0 2px 8px 0 rgb(32 40 45 / 8%)",
        "DEFAULT": "0 2px 14px 0 rgb(32 40 45 / 10%)",
        "md":    "0 4px 20px 0 rgb(32 40 45 / 12%)",
        "lg":    "0 6px 30px -2px rgb(32 40 45 / 14%)",
        "xl":    "0 10px 40px -4px rgb(32 40 45 / 16%)",
        "2xl":   "0 20px 60px -8px rgb(32 40 45 / 20%)",
        "card":       "0 2px 14px 0 rgb(32 40 45 / 8%)",
        "card-hover": "0 4px 20px 0 rgb(32 40 45 / 12%)",
        "panel":      "0 4px 20px 0 rgb(32 40 45 / 10%)",
        "modal":      "0 10px 40px -4px rgb(32 40 45 / 14%)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "page-enter": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "page-enter":     "page-enter 200ms cubic-bezier(0.4,0,0.2,1) both",
        "fade-in":        "fade-in 0.3s ease-out forwards",
        "slide-up":       "slide-up 0.4s ease-out forwards",
        "scale-in":       "scale-in 0.25s ease-out forwards",
        "count-up":       "count-up 0.4s ease forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
