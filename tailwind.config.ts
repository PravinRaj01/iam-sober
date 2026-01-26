import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        // Tailwind will expose `font-alfa-slab`
        "alfa-slab": ['"Alfa Slab One"', "serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-success': 'var(--gradient-success)',
        'gradient-calm': 'var(--gradient-calm)',
        'gradient-purple': 'var(--gradient-purple)',
      },
      boxShadow: {
        'soft': 'var(--shadow-soft)',
        'glow': 'var(--shadow-glow)',
        'elegant': 'var(--shadow-elegant)',
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "counter": {
          from: { transform: "scale(1.2)" },
          to: { transform: "scale(1)" },
        },
        "glow-rotate": {
          "0%": {
            "box-shadow": "0 0 20px 2px rgba(255, 255, 255, 0.8), 0 0 40px 4px rgba(255, 255, 255, 0.4), inset 0 0 20px 2px rgba(255, 255, 255, 0.2)",
            "border-image-source": "linear-gradient(0deg, rgba(255,255,255,0.8), rgba(255,255,255,0.2), rgba(255,255,255,0.8))",
          },
          "25%": {
            "box-shadow": "0 0 20px 2px rgba(255, 255, 255, 0.6), 0 0 40px 4px rgba(255, 255, 255, 0.3), inset 0 0 20px 2px rgba(255, 255, 255, 0.15)",
            "border-image-source": "linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.2), rgba(255,255,255,0.8))",
          },
          "50%": {
            "box-shadow": "0 0 20px 2px rgba(255, 255, 255, 0.8), 0 0 40px 4px rgba(255, 255, 255, 0.4), inset 0 0 20px 2px rgba(255, 255, 255, 0.2)",
            "border-image-source": "linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,255,255,0.2), rgba(255,255,255,0.8))",
          },
          "75%": {
            "box-shadow": "0 0 20px 2px rgba(255, 255, 255, 0.6), 0 0 40px 4px rgba(255, 255, 255, 0.3), inset 0 0 20px 2px rgba(255, 255, 255, 0.15)",
            "border-image-source": "linear-gradient(270deg, rgba(255,255,255,0.8), rgba(255,255,255,0.2), rgba(255,255,255,0.8))",
          },
          "100%": {
            "box-shadow": "0 0 20px 2px rgba(255, 255, 255, 0.8), 0 0 40px 4px rgba(255, 255, 255, 0.4), inset 0 0 20px 2px rgba(255, 255, 255, 0.2)",
            "border-image-source": "linear-gradient(360deg, rgba(255,255,255,0.8), rgba(255,255,255,0.2), rgba(255,255,255,0.8))",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "counter": "counter 0.3s ease-out",
        "glow-rotate": "glow-rotate 3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
