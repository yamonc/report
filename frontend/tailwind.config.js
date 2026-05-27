/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          root: "var(--bg-root)",
          surface: "var(--bg-surface)",
          elevated: "var(--bg-elevated)",
          sidebar: "var(--bg-sidebar)",
          hover: "var(--bg-hover)",
          active: "var(--bg-active)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
          glow: "var(--accent-glow)",
          subtle: "var(--accent-subtle)",
        },
        success: {
          DEFAULT: "var(--success)",
          bg: "var(--success-bg)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          bg: "var(--warning-bg)",
        },
        info: {
          DEFAULT: "var(--info)",
          bg: "var(--info-bg)",
        },
        purple: {
          DEFAULT: "var(--purple)",
          bg: "var(--purple-bg)",
        },
        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border)",
          visible: "var(--border-visible)",
          focus: "var(--border-focus)",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', '"STSong"', '"SimSun"', '"Songti SC"', "serif"],
        sans: ['"Noto Sans SC"', '"Source Han Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', '"Hiragino Sans GB"', "sans-serif"],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', '"Fira Code"', '"SF Mono"', '"Menlo"', "monospace"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease-out both",
        "glow": "glow 2s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 12px var(--accent-glow)" },
          "50%": { boxShadow: "0 0 24px var(--accent-glow)" },
        },
      },
    },
  },
  plugins: [],
}
