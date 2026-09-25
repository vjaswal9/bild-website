import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // src/lib was missing. The shared button styles live in src/lib/ui.ts, so
    // any class used only there was silently never generated: the primary
    // button's gradient ended in `to-gold-600`, which produced no CSS, leaving
    // the button fading to transparent rather than to gold.
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Rich gold — deeper, more premium than bright yellow-orange
        // Rich gold - deeper and more saturated than the identity brass.
        //
        // The brand pack's Premium Gold (#C8A64B) was tried here and read as
        // washed out on screen against the dark hero, so the website keeps
        // this warmer, more vivid amber as its lead accent. The consequence is
        // that the logo carries a slightly different gold from the buttons
        // beside it; see branding/README.md.
        gold: {
          50:  '#fdf8f0',   // warm cream - page background (identical to `cream`)
          100: '#faefd9',
          200: '#f4d99b',
          400: '#e0a135',   // accent on dark grounds
          500: '#C8861A',   // primary button colour - rich burnished gold
          600: '#a86a10',   // accent text on light grounds
          700: '#7d4e0a',   // small accent text (6.7:1 on cream)
        },
        // Keep saffron alias pointing to gold for backward compat
        saffron: {
          50:  '#fdf8f0',
          100: '#faefd9',
          200: '#f4d99b',
          400: '#e0a135',
          500: '#C8861A',
          600: '#a86a10',
          700: '#7d4e0a',
        },
        // Deep Indian red — secondary accent
        ruby: {
          500: '#9B2335',
          600: '#7e1c2b',
        },
        // Neutral near-blacks, matching the identity's Onyx.
        //
        // These were Tailwind's default slate, which carries a blue cast: on a
        // dark hero next to a warm gold the whole page read slightly cool.
        // Every one of these is higher contrast than the value it replaced.
        charcoal: {
          600: '#4A4A4A',   // 8.4:1 on cream
          700: '#2E2E2E',   // 12.8:1 on cream
          800: '#1A1A1A',   // 16.5:1 on cream
          900: '#0E0E0E',   // Onyx Black - the identity dark
        },
        // Third section ground.
        //
        // The palette had only two usable page-section tones: cream and the
        // dark charcoals. `gold-50` looks like a third but is the identical
        // hex to cream, so alternating between them changes nothing on screen.
        //
        // `stone` is a desaturated warm neutral rather than another golden
        // tint, so it reads as a different material next to cream instead of
        // simply more yellow. Checked for contrast: charcoal-800 on stone-100
        // is 11.6:1, charcoal-600 is 6.0:1, and the step from cream is 1.20,
        // comfortably more visible than the 1.09 of a typical banded layout.
        stone: {
          50:  '#F4F1EB',   // barely-there band, for use inside a cream section
          100: '#E9E4DB',   // the section ground
          200: '#D9D1C2',   // borders and dividers on a stone section
        },
        cream: '#fdf8f0',
      },
      boxShadow: {
        // The standard raised-card shadow. Was written out as an arbitrary
        // value in ten places across six files, so changing it meant finding
        // all ten.
        card: '0 6px 24px rgba(20, 20, 20, 0.05)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-playfair)', '"Playfair Display"', 'Georgia', 'serif'],
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        // Staggered entrance for above-the-fold content. These mirror the
        // hero's old Framer Motion timings, but as CSS they run at first paint
        // instead of waiting for React to hydrate (which was costing seconds
        // of Largest Contentful Paint on mobile). "backwards" keeps the
        // element hidden during its delay.
        'fade-up-d1': 'fadeUp 0.6s ease-out 0.15s backwards',
        'fade-up-d2': 'fadeUp 0.6s ease-out 0.35s backwards',
        'fade-up-d3': 'fadeUp 0.6s ease-out 0.55s backwards',
        'fade-up-d4': 'fadeUp 0.6s ease-out 0.7s backwards',
        'page-in': 'pageIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        // The review carousel and the join form's step change. Both used to
        // run through Framer Motion, which cost 122KB on the homepage and the
        // join funnel to fade and slide two elements. Same job, no library.
        'slide-in': 'slideIn 0.35s cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'step-in': 'stepIn 0.25s ease-out both',
        'glow-drift-1': 'glowDrift1 14s ease-in-out infinite',
        'glow-drift-2': 'glowDrift2 17s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(28px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        stepIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Matches the page transition that used to run through Framer Motion.
        // WARNING: this animation wraps every page (see PageTransition), and
        // because it is 'forwards' the finished animation keeps producing an
        // animated transform - which computes to an identity matrix, never to
        // 'none'. That makes the wrapper a containing block for every
        // position:fixed descendant, so a fixed overlay rendered inside a page
        // anchors to the full-height wrapper instead of the viewport.
        //
        // Two fixes were tried and both failed: setting the 100% keyframe to
        // 'transform: none' (a filling animation still computes a matrix) and
        // dropping 'forwards' (a throttled or backgrounded tab then leaves the
        // page stuck on the 0% keyframe, i.e. invisible).
        //
        // So do not render a modal or overlay inside the page tree. Portal it
        // to document.body, as PhotoVaultClient does.
        pageIn: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.985)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // Slow ambient drift + breathing for the spotlight panel's gold glows.
        glowDrift1: {
          '0%, 100%': { transform: 'translate(0, -33%) scale(1)', opacity: '0.2' },
          '50%': { transform: 'translate(6%, -25%) scale(1.15)', opacity: '0.3' },
        },
        glowDrift2: {
          '0%, 100%': { transform: 'translate(0, 33%) scale(1)', opacity: '0.15' },
          '50%': { transform: 'translate(-8%, 25%) scale(1.2)', opacity: '0.25' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(200,134,26,0.5)' },
          '50%': { boxShadow: '0 0 0 12px rgba(200,134,26,0)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
}
export default config
