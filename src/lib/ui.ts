// Canonical button styles - single source of truth so every CTA looks the same
// and every button has a visible keyboard focus ring. Append size classes
// (e.g. `px-8 py-4 text-lg`) per usage; the look stays consistent.

const btnBase =
  'inline-flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none'

// Primary gold CTA (gradient + depth + press).
//
// Runs gold-500 to gold-600, not gold-400 to gold-600. White on gold-400 is
// only 2.25:1, which fails; on gold-500 it is 3.05:1 and on gold-600 4.44:1,
// both of which pass at this size and weight. The old gradient started at
// gold-400 and got away with it only because `to-gold-600` was never
// generated (src/lib was missing from Tailwind's content globs), so the
// button faded to transparent instead of rendering the gradient at all.
export const btnPrimary =
  `${btnBase} rounded-xl bg-gradient-to-b from-gold-500 to-gold-600 text-white shadow-lg shadow-gold-500/20 hover:from-gold-600 hover:to-gold-700 hover:shadow-gold-500/30 focus-visible:ring-gold-500`

// Secondary outline for light backgrounds.
export const btnOutline =
  `${btnBase} rounded-xl border-2 border-charcoal-700 text-charcoal-700 hover:bg-charcoal-700 hover:text-white focus-visible:ring-charcoal-500`

// Outline for dark backgrounds (e.g. the hero).
export const btnOutlineOnDark =
  `${btnBase} rounded-xl border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 focus-visible:ring-white/70`
