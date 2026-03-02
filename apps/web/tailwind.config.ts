import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          pink:      "#F9B4C8",   // pastel pink — nền chính (từ ảnh ref)
          hot:       "#E8607A",   // hot pink — accent/button
          rose:      "#D4708F",   // medium rose — text accent
          deep:      "#8B3A50",   // deep rose — heading text
          blush:     "#FCD5E0",   // blush nhạt hơn nền
          white:     "#FFFFFF",   // card surfaces
          cream:     "#FFF5F7",   // off-white hồng rất nhạt
          gold:      "#C07828",   // warm amber gold — punchy trên pink bg
          mauve:     "#C06A82",   // mauve — secondary button
        },
        prize: {
          first:  "#B8860B",   // dark goldenrod — rich & luxe
          second: "#6B6B78",   // cool slate — đọc rõ trên pink
          third:  "#A0603C",   // sienna bronze — ấm, nổi bật
          cons:   "#B03060",   // deep magenta rose — tách khỏi nền
        },
        status: {
          waiting:  "#A78BBA",  // lavender
          locked:   "#E8607A",  // hot pink
          spinning: "#C07828",  // warm amber (match brand-gold)
          done:     "#8BA89B",  // sage green
        },
      },
      fontFamily: {
        sans: ["Be Vietnam Pro", "Montserrat", "Arial", "sans-serif"],
      },
      animation: {
        "spin-slow":    "spin 3s linear infinite",
        pulse:          "pulse 1s ease-in-out infinite",
        "bounce-slow":  "bounce 2s ease-in-out infinite",
        glow:           "glow 1.5s ease-in-out infinite alternate",
        "fade-in":      "fadeIn 0.6s ease-out",
        "slide-up":     "slideUp 0.5s ease-out",
        float:          "floatGentle 4s ease-in-out infinite",
        shimmer:        "shimmerRose 4s linear infinite",
        breathe:        "breathe 4s ease-in-out infinite",
        "soft-glow":    "softGlow 3s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          from: { boxShadow: "0 0 10px rgba(232,96,122,0.3)" },
          to:   { boxShadow: "0 0 30px rgba(232,96,122,0.4), 0 0 60px rgba(249,180,200,0.3)" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        floatGentle: {
          "0%, 100%": { transform: "translateY(0px) rotate(-0.5deg)" },
          "50%":      { transform: "translateY(-6px) rotate(0.5deg)" },
        },
        shimmerRose: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.8" },
          "50%":      { transform: "scale(1.03)", opacity: "1" },
        },
        softGlow: {
          from: { boxShadow: "0 0 15px rgba(232,96,122,0.15), 0 0 30px rgba(249,180,200,0.1)" },
          to:   { boxShadow: "0 0 25px rgba(232,96,122,0.25), 0 0 50px rgba(249,180,200,0.2)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
